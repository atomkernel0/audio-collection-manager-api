# Users API Endpoints

Cette documentation fournit des informations détaillées sur les endpoints de l'API utilisateur.

## Authentification

### Inscription d'un utilisateur

**Endpoint:** `POST /auth/register`

Permet à un nouvel utilisateur de s'inscrire.

**Corps de la requête:**
```json
{
  "username": "string",
  "password": "string",
  "hcaptchaResponse": "string"
}
```

**Réponse réussie:**
```json
{
  "message": "Utilisateur enregistré avec succès",
  "token": "string"
}
```

**Codes d'erreur possibles:**
- 400: Entrée invalide
- 409: Nom d'utilisateur déjà pris
- 500: Erreur interne du serveur

### Connexion d'un utilisateur

**Endpoint:** `POST /auth/login`

Permet à un utilisateur existant de se connecter.

**Corps de la requête:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Réponse réussie:**
```json
{
  "message": "Connexion réussie.",
  "user": {
    "username": "string"
  },
  "token": "string"
}
```

**Codes d'erreur possibles:**
- 400: Entrée invalide
- 401: Identifiants invalides
- 500: Erreur interne du serveur

## Informations utilisateur

### Obtenir les informations de l'utilisateur

**Endpoint:** `GET /users/me`

Récupère les informations de l'utilisateur authentifié.

**En-têtes requis:**
- `Authorization: Bearer <token>`

**Réponse réussie:**
```json
{
  "user": {
    "userId": "string",
    "username": "string",
    "createdAt": "string",
    "playlistsCount": "number",
    "hasFavoritePlaylist": "boolean",
    "totalPlays": "number",
    "favoriteCount": "number"
  }
}
```

**Codes d'erreur possibles:**
- 401: Non autorisé
- 404: Utilisateur non trouvé
- 500: Erreur interne du serveur

## Statistiques d'écoute

### Obtenir les statistiques d'écoute de l'utilisateur

**Endpoint:** `GET /stats`

Récupère les statistiques d'écoute globales de l'utilisateur authentifié.

**En-têtes requis:**
- `Authorization: Bearer <token>`

**Réponse réussie:**
```json
{
  "listenedSongs": [
    {
      "songTitle": "string",
      "songFile": "string",
      "albumId": "string",
      "playCount": "number",
      "listenHistory": ["date"]
    }
  ],
  "listenedAlbums": [
    {
      "albumId": "string",
      "playCount": "number",
      "listenHistory": ["date"]
    }
  ]
}
```

**Codes d'erreur possibles:**
- 401: Non autorisé
- 404: Utilisateur non trouvé
- 500: Erreur interne du serveur

## Écoute de chansons et d'albums

### Enregistrer l'écoute d'une chanson

**Endpoint:** `POST /songs/listen`

Enregistre l'écoute d'une chanson pour l'utilisateur authentifié.

**En-têtes requis:**
- `Authorization: Bearer <token>`

**Corps de la requête:**
```json
{
  "songTitle": "string",
  "songFile": "string",
  "albumId": "string"
}
```

**Réponse réussie:**
```json
{
  "message": "Chanson écoutée avec succès"
}
```

**Codes d'erreur possibles:**
- 400: Entrée invalide
- 401: Non autorisé
- 404: Utilisateur non trouvé
- 500: Erreur interne du serveur

### Obtenir l'historique des chansons écoutées

**Endpoint:** `GET /songs/history`

Récupère les 30 dernières chansons écoutées par l'utilisateur authentifié.

**En-têtes requis:**
- `Authorization: Bearer <token>`

**Réponse réussie:**
```json
{
  "listenedSongs": [
    {
      "title": "string",
      "file": "string",
      "listenedAt": "date",
      "playCount": "number",
      "listenHistory": ["date"],
      "albumTitle": "string",
      "albumArtist": "string",
      "albumCover": "string",
      "albumLang": "string",
      "albumId": "string"
    }
  ]
}
```

**Codes d'erreur possibles:**
- 401: Non autorisé
- 404: Utilisateur non trouvé
- 500: Erreur interne du serveur

### Enregistrer l'écoute d'un album

**Endpoint:** `POST /albums/listen`

Enregistre l'écoute d'un album pour l'utilisateur authentifié.

**En-têtes requis:**
- `Authorization: Bearer <token>`

**Corps de la requête:**
```json
{
  "albumId": "string"
}
```

**Réponse réussie:**
```json
{
  "message": "Album écouté avec succès"
}
```

**Codes d'erreur possibles:**
- 400: Entrée invalide
- 401: Non autorisé
- 404: Album non trouvé
- 500: Erreur interne du serveur

### Obtenir les albums écoutés

**Endpoint:** `GET /albums/listened`

Récupère les 15 derniers albums écoutés par l'utilisateur authentifié.

**En-têtes requis:**
- `Authorization: Bearer <token>`

**Réponse réussie:**
```json
{
  "albums": [
    {
      "_id": "string",
      "title": "string",
      "artist": "string",
      "cover": "string",
      "coverAvif": "string",
      "lang": "string",
      "songLength": "number"
    }
  ]
}
```

**Codes d'erreur possibles:**
- 401: Non autorisé
- 500: Erreur interne du serveur

## Modification du compte

### Changer le nom d'utilisateur

**Endpoint:** `PATCH /users/username`

Permet à l'utilisateur authentifié de changer son nom d'utilisateur.

**En-têtes requis:**
- `Authorization: Bearer <token>`

**Corps de la requête:**
```json
{
  "newUsername": "string"
}
```

**Réponse réussie:**
```json
{
  "message": "Nom d'utilisateur mis à jour avec succès",
  "newUsername": "string",
  "token": "string"
}
```

**Codes d'erreur possibles:**
- 400: Entrée invalide
- 401: Non autorisé
- 404: Utilisateur non trouvé
- 409: Nom d'utilisateur déjà pris
- 500: Erreur interne du serveur

Voici la suite de la documentation des endpoints de l'API, en continuant à partir de "Changer le mot de passe" :

### Changer le mot de passe

**Endpoint:** `PATCH /users/password`

Permet à l'utilisateur authentifié de changer son mot de passe.

**En-têtes requis:**
- `Authorization: Bearer <token>`

**Corps de la requête:**
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

**Réponse réussie:**
```json
{
  "message": "Mot de passe mis à jour avec succès"
}
```

**Codes d'erreur possibles:**
- 400: Entrée invalide
- 401: Non autorisé ou mot de passe actuel incorrect
- 404: Utilisateur non trouvé
- 500: Erreur interne du serveur

### Supprimer le compte

**Endpoint:** `DELETE /users`

Permet à l'utilisateur authentifié de supprimer son compte et toutes les données associées.

**En-têtes requis:**
- `Authorization: Bearer <token>`

**Réponse réussie:**
```json
{
  "message": "Compte supprimé avec succès"
}
```

**Codes d'erreur possibles:**
- 401: Non autorisé
- 404: Utilisateur non trouvé
- 500: Erreur interne du serveur

## Gestion des favoris

### Ajouter un album aux favoris

**Endpoint:** `POST /albums/favorite`

Ajoute un album aux favoris de l'utilisateur authentifié.

**En-têtes requis:**
- `Authorization: Bearer <token>`

**Corps de la requête:**
```json
{
  "albumId": "string"
}
```

**Réponse réussie:**
```json
{
  "message": "Album added to favorites"
}
```

**Codes d'erreur possibles:**
- 400: ID d'album invalide
- 401: Non autorisé
- 404: Album non trouvé
- 409: L'album est déjà dans les favoris
- 500: Erreur interne du serveur

### Retirer un album des favoris

**Endpoint:** `DELETE /albums/favorite`

Retire un album des favoris de l'utilisateur authentifié.

**En-têtes requis:**
- `Authorization: Bearer <token>`

**Corps de la requête:**
```json
{
  "albumId": "string"
}
```

**Réponse réussie:**
```json
{
  "message": "Album removed from favorites"
}
```

**Codes d'erreur possibles:**
- 400: ID d'album invalide
- 401: Non autorisé
- 404: Album non trouvé dans les favoris
- 500: Erreur interne du serveur

### Vérifier si un album est dans les favoris

**Endpoint:** `GET /albums/favorite-check`

Vérifie si un album spécifique est dans les favoris de l'utilisateur authentifié.

**En-têtes requis:**
- `Authorization: Bearer <token>`

**Paramètres de requête:**
- `albumId`: string (obligatoire)

**Réponse réussie:**
```json
{
  "isFavorite": "boolean"
}
```

**Codes d'erreur possibles:**
- 400: ID d'album manquant ou invalide
- 401: Non autorisé
- 500: Erreur interne du serveur

### Obtenir tous les albums favoris

**Endpoint:** `GET /albums/favorites`

Récupère tous les albums favoris de l'utilisateur authentifié.

**En-têtes requis:**
- `Authorization: Bearer <token>`

**Réponse réussie:**
```json
{
  "albums": [
    {
      "_id": "string",
      "title": "string",
      "artist": "string",
      "cover": "string",
      "coverAvif": "string",
      "lang": "string",
      "songLength": "number"
    }
  ]
}
```

**Codes d'erreur possibles:**
- 401: Non autorisé
- 500: Erreur interne du serveur

## Notes importantes

1. Tous les endpoints, à l'exception de l'inscription et de la connexion, nécessitent un token JWT valide dans l'en-tête `Authorization`.

2. Les endpoints d'inscription et de connexion sont soumis à une limite de taux pour prévenir les abus.

3. Les réponses d'erreur incluent généralement un message détaillé expliquant la nature de l'erreur.

4. Toutes les dates sont renvoyées au format ISO 8601.

5. Les URLs des couvertures d'albums sont formatées pour être compatibles avec le CDN du projet.

6. Les titres d'albums sont formatés pour supprimer les préfixes communs et les caractères diacritiques.

7. La plupart des opérations de lecture et d'écriture sont optimisées pour la performance, avec une mise en cache basique pour les informations utilisateur fréquemment accédées.