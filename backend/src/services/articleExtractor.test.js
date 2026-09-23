const { isPrivateIp, assertUrlEsSegura } = require('./articleExtractor');

describe('isPrivateIp', () => {
  test('detecta direcciones privadas/internas comunes', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('10.0.0.5')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true); // metadata de nube (AWS/GCP)
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
    expect(isPrivateIp('fd00::1')).toBe(true);
  });

  test('no marca direcciones publicas como privadas', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('172.15.0.1')).toBe(false); // justo fuera del rango 172.16-31
    expect(isPrivateIp('172.32.0.1')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
  });
});

describe('assertUrlEsSegura', () => {
  test('rechaza protocolos que no son http/https', async () => {
    await expect(assertUrlEsSegura('file:///etc/passwd')).rejects.toThrow('Solo se permiten URLs http o https.');
    await expect(assertUrlEsSegura('ftp://ejemplo.com')).rejects.toThrow('Solo se permiten URLs http o https.');
  });

  test('rechaza una URL malformada', async () => {
    await expect(assertUrlEsSegura('no-es-una-url')).rejects.toThrow('La URL no es valida.');
  });
});
