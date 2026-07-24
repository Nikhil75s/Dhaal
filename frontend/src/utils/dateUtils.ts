export const getISTDateString = (d: Date = new Date()) => {
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const istDate = new Date(utc + (330 * 60000));
  return `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
};

export const parseISTDate = (dateStr: string) => {
  if (dateStr.includes(" ")) {
    return new Date(dateStr.replace(" ", "T") + "+05:30");
  } else if (dateStr.includes("T")) {
    return new Date(dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "+05:30");
  } else {
    return new Date(dateStr + "T00:00:00+05:30");
  }
};
