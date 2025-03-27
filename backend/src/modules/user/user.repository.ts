/**
 * @file user.repository.ts
 * @description Capa de acceso a datos para usuarios.
 *
 * El repositorio encapsula las consultas a Prisma relacionadas con la entidad `User`.
 * El servicio nunca llama a Prisma directamente para facilitar la sustitución
 * por mocks en tests unitarios.
 *
 * Nota: el campo `anthropicApiKey` no se expone por GraphQL pero sí se almacena
 * en la BD; las operaciones relacionadas con él se gestionan directamente en el
 * servicio usando el cliente Prisma, no a través de este repositorio.
 */
import { PrismaClient, User } from '@prisma/client';

/**
 * Repositorio de usuarios.
 * Cada método traduce una operación de negocio a una consulta Prisma concreta.
 */
export class UserRepository {
  /**
   * @param db - Cliente Prisma inyectado desde el contexto de la petición.
   */
  constructor(private readonly db: PrismaClient) {}

  /**
   * Busca un usuario por su ID primario.
   * Devuelve `null` si no existe para que el servicio decida cómo manejar el caso.
   *
   * @param id - ID único del usuario.
   */
  async findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  /**
   * Busca un usuario por su dirección de correo electrónico.
   * Se utiliza en flujos de autenticación e invitación donde el email es el identificador.
   *
   * @param email - Correo electrónico del usuario.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  /**
   * Actualiza campos del perfil de un usuario.
   * Los campos son opcionales para permitir actualizaciones parciales.
   *
   * @param id   - ID del usuario a actualizar.
   * @param data - Campos opcionales: nombre visible y/o URL del avatar.
   */
  async update(id: string, data: { name?: string; avatarUrl?: string }): Promise<User> {
    return this.db.user.update({ where: { id }, data });
  }
}
