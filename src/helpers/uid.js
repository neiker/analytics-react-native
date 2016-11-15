export const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function uid(length) {
  return Array.from(Array(length)).reduce(
    res => res + chars[Math.floor((Math.random()) * chars.length)],
    '',
  );
}
