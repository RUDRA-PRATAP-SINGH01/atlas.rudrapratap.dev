/** Build a GitHub blob URL for a verified source path / code ref. */
export function getGithubSourceUrl(path, codeRef, project) {
  const base =
    project === "rate-limiter"
      ? "https://github.com/RUDRA-PRATAP-SINGH01/Distributed-rate-limiter/blob/main"
      : "https://github.com/RUDRA-PRATAP-SINGH01/PebbleDB/blob/main";
  if (!path) return null;
  let url = `${base}/${path}`;
  if (codeRef && codeRef.lineStart) {
    url += `#L${codeRef.lineStart}`;
    if (codeRef.lineEnd) {
      url += `-L${codeRef.lineEnd}`;
    }
  }
  return url;
}
