/**
 * Represents the structure of an API error response
 * @interface
 */
export interface ApiError {
  status: number;
  message: string;
  code: string;
}

/**
 * Collection of standardized API error responses
 * Used for consistent error handling across the application
 */
export const ApiErrors = {
  UNAUTHORIZED: { status: 401, message: "Non autorisé", code: "UNAUTHORIZED" },
  INVALID_CREDENTIALS: {
    status: 401,
    message: "Identifiants invalides",
    code: "INVALID_CREDENTIALS",
  },
  NOT_FOUND: {
    status: 404,
    message: "Ressource non trouvée",
    code: "NOT_FOUND",
  },
  USER_NOT_FOUND: {
    status: 404,
    message: "Utilisateur non trouvé",
    code: "USER_NOT_FOUND",
  },
  CONFLICT: {
    status: 409,
    message: "Conflit avec une ressource existante",
    code: "CONFLICT",
  },
  USERNAME_TAKEN: {
    status: 409,
    message: "Ce nom d'utilisateur n'est pas disponible",
    code: "USERNAME_TAKEN",
  },
  INVALID_INPUT: {
    status: 400,
    message: "Données d'entrée invalides",
    code: "INVALID_INPUT",
  },
  INTERNAL_ERROR: {
    status: 500,
    message: "Erreur interne du serveur",
    code: "INTERNAL_ERROR",
  },
} as const;
