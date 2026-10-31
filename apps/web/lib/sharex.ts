export function sharexConfig(server: string, token: string, name: string) {
  return {
    Version: '17.0.0',
    Name: `triton · ${name}`,
    DestinationType: 'ImageUploader, TextUploader, FileUploader',
    RequestMethod: 'PUT',
    RequestURL: `${server}/api/files`,
    Parameters: { filename: '{filename}' },
    Headers: { Authorization: `Bearer ${token}` },
    Body: 'Binary',
    URL: '{json:url}',
    ErrorMessage: '{json:error}'
  };
}

export function sharexFileName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `triton-${slug || 'sharex'}.sxcu`;
}
