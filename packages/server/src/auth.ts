export function validateApiKey(apiKey: string | undefined): boolean {
  if (apiKey === undefined || apiKey === null || apiKey === "") return false;
  return apiKey === process.env.API_KEY;
}
