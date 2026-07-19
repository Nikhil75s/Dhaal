// Service layer for reports_api.
// Responsibilities:
// - Generate PDF using Catalyst SmartBrowz.
// - Upload PDF to Catalyst Stratus.
// - Record metadata in Catalyst Data Store via the repository.

const ReportsRepository = require('../repositories/reportsRepository.js');
const catalyst = require('zcatalyst-sdk-node');
const { logger } = require('../utils/logger');

// Configurable Template and Folder IDs
const SMARTBROWZ_TEMPLATE_ID = process.env.SMARTBROWZ_TEMPLATE_ID;
const STRATUS_FOLDER_ID = process.env.STRATUS_FOLDER_ID;

class ReportsService {
  constructor(repository = new ReportsRepository()) {
    this.repository = repository;
  }

  /**
   * Generates a PDF intelligence brief and stores it in Stratus.
   *
   * @param {object} args - The anomaly alert payload.
   * @param {object} req - The incoming Catalyst request object.
   * @param {object} context - The Catalyst context.
   * @returns {Promise<object>} Pipeline execution result and metadata.
   */
  async generateIntelligenceBrief(args, req, context) {
    logger.info('Starting Intelligence Brief generation for alert', { alertId: args.alertId });

    if (!SMARTBROWZ_TEMPLATE_ID) {
      throw new Error('Configuration Error: SMARTBROWZ_TEMPLATE_ID is missing');
    }
    
    if (!STRATUS_FOLDER_ID) {
      throw new Error('Configuration Error: STRATUS_FOLDER_ID is missing');
    }

    try {
      const catalystApp = catalyst.initialize(req);
      
      // 1. Generate PDF using Catalyst SmartBrowz
      logger.info('Generating PDF with SmartBrowz', { templateId: SMARTBROWZ_TEMPLATE_ID });
      const smartbrowz = catalystApp.smartbrowz();
      
      // generateFromTemplate returns Promise<Readable>
      const pdfStream = await smartbrowz.generateFromTemplate(
        SMARTBROWZ_TEMPLATE_ID,
        { data: args }
      );
      
      // 2. Upload to Catalyst Stratus (FileStore)
      logger.info('Uploading PDF to Stratus FileStore', { folderId: STRATUS_FOLDER_ID });
      const filestore = catalystApp.filestore();
      const folder = filestore.folder(STRATUS_FOLDER_ID);
      const fileName = `intelligence_brief_${args.alertId}_${Date.now()}.pdf`;
      
      const uploadConfig = {
        code: pdfStream,
        name: fileName
      };
      
      const uploadResult = await folder.uploadFile(uploadConfig);
      
      logger.info('PDF uploaded successfully', { uploadResultId: uploadResult.id });

      // 3. Save metadata to Data Store (IntelligenceReports table)
      const metadata = {
        alertId: args.alertId,
        // Using the actual file ID from the Catalyst response instead of a fabricated URL
        pdfUrl: uploadResult.id,
        generatedDate: new Date().toISOString()
      };

      const dbResult = await this.repository.insertReportMetadata(req, metadata);

      // 4. Return standard response payload
      return {
        message: 'Intelligence Brief generated successfully',
        data: {
          reportId: dbResult.ROWID,
          alertId: metadata.alertId,
          pdfUrl: metadata.pdfUrl,
          generatedDate: metadata.generatedDate
        }
      };
    } catch (error) {
      logger.error('Failed to generate intelligence brief pipeline', error);
      error.statusCode = 500;
      error.message = error.message || 'Intelligence Brief generation failed';
      throw error;
    }
  }
}

module.exports = ReportsService;
