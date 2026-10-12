import { describe, expect, it } from 'vitest';
import { deriveAccount, open, recordId, seal } from './crypto';

// Iteraciones bajas solo para que el test sea rápido.
const IT = 1000;

describe('cifrado de extremo a extremo', () => {
  it('el secreto de acceso no es la contraseña y es estable', async () => {
    const a = await deriveAccount('Ana@Mail.com ', 'una contraseña larga', IT);
    const b = await deriveAccount('ana@mail.com', 'una contraseña larga', IT);
    expect(a.authSecret).toBe(b.authSecret);
    expect(a.authSecret).not.toContain('contraseña');
    const c = await deriveAccount('ana@mail.com', 'otra contraseña', IT);
    expect(c.authSecret).not.toBe(a.authSecret);
  });

  it('cifra y descifra; el id del servidor no revela la fecha', async () => {
    const { keys } = await deriveAccount('ana@mail.com', 'secreta', IT);
    const id = await recordId(keys.idKey, 'entry', '2026-10-12');
    expect(id).not.toContain('2026');
    const value = { kind: 'entry', key: '2026-10-12', data: { notes: 'Caminata larga' } };
    const sealed = await seal(keys.encKey, id, value);
    expect(sealed.ciphertext).not.toContain('Caminata');
    expect(await open(keys.encKey, id, sealed)).toEqual(value);
  });

  it('falla con otra llave o si se mueve el texto cifrado a otro id', async () => {
    const { keys } = await deriveAccount('ana@mail.com', 'secreta', IT);
    const other = await deriveAccount('ana@mail.com', 'otra', IT);
    const id = await recordId(keys.idKey, 'entry', '2026-10-12');
    const sealed = await seal(keys.encKey, id, { x: 1 });
    await expect(open(other.keys.encKey, id, sealed)).rejects.toBeTruthy();
    const otherId = await recordId(keys.idKey, 'entry', '2026-10-13');
    await expect(open(keys.encKey, otherId, sealed)).rejects.toBeTruthy();
  });
});
