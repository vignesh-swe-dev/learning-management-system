export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');

// Value for <input type="datetime-local"> in the user's own time zone.
export const toLocalInput = (date) => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};
export const tomorrowEvening = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(23, 59, 0, 0);
  return toLocalInput(d);
};

export async function downloadBlob(api, url, fallbackName) {
  const res = await api.get(url, { responseType: 'blob' });
  const match = /filename="?([^"]+)"?/.exec(res.headers['content-disposition'] || '');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(res.data);
  link.download = match ? decodeURIComponent(match[1]) : fallbackName;
  link.click();
  URL.revokeObjectURL(link.href);
}
