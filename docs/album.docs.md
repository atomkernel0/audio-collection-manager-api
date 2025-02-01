
# Endpoints de l'API Albums
## Documentation des Endpoints de l'API Albums

Cette page décrit les endpoints de l'API Albums.

## Obtenir tous les albums

Récupère tous les albums (mis en cache pendant 1 jour par défaut).

```http
GET /albums
```

### Paramètres

Aucun

### Réponse

```json
{
  "albums": [
    {
      "title": "Titre de l'album",
      "artist": ["Artiste"],
      "cover": "URL de la pochette",
      "coverAvif": "URL de la pochette en AVIF",
      "lang": "Langue",
      "songLength": 10
    }
  ]
}
```

## Obtenir les albums par ordre

Récupère les albums, triés par titre normalisé, avec pagination.

```http
GET /albums/order
```

### Paramètres de requête

| Nom   | Type    | Description                           |
|-------|---------|---------------------------------------|
| page  | integer | Numéro de page (par défaut : 1)       |
| limit | integer | Nombre d'albums par page (max : 100)  |

### Réponse

```json
{
  "albums": [
    {
      "title": "Titre de l'album",
      "artist": ["Artiste"],
      "cover": "URL de la pochette",
      "coverAvif": "URL de la pochette en AVIF",
      "lang": "Langue",
      "songLength": 10
    }
  ]
}
```

## Obtenir un album spécifique

Récupère les informations détaillées d'un album.

```http
GET /albums/album
```

### Paramètres de requête

| Nom     | Type   | Description                   |
|---------|--------|-------------------------------|
| albumId | string | Identifiant unique de l'album |

### Réponse

```json
{
  "title": "Titre de l'album",
  "artist": ["Artiste"],
  "cover": "URL de la pochette",
  "songs": [
    {
      "title": "Titre de la chanson",
      "file": "URL du fichier audio",
      "albumTitle": "Titre de l'album",
      "albumArtist": ["Artiste"],
      "albumCover": "URL de la pochette",
      "albumLang": "Langue",
      "albumId": "ID de l'album"
    }
  ]
}
```

## Rechercher des albums

Recherche des albums par titre ou artiste en utilisant une correspondance floue.

```http
GET /albums/search
```

### Paramètres de requête

| Nom | Type   | Description        |
|-----|--------|--------------------|
| q   | string | Terme de recherche |

### Réponse

```json
{
  "albums": [
    {
      "title": "Titre de l'album",
      "artist": ["Artiste"],
      "cover": "URL de la pochette",
      "lang": "Langue",
      "songLength": 10
    }
  ]
}
```

## Obtenir tous les artistes

Récupère une liste de tous les artistes avec le nombre total de chansons et d'albums.

```http
GET /albums/artists
```

### Paramètres

Aucun

### Réponse

```json
{
  "artists": [
    {
      "name": "Nom de l'artiste",
      "totalSongs": 50,
      "totalAlbums": 5,
      "representativeCover": "URL de la pochette représentative"
    }
  ]
}
```

## Obtenir les albums les plus écoutés

Récupère les 8 albums les plus écoutés basés sur le nombre d'écoutes des utilisateurs.

```http
GET /albums/most-listened
```

### Paramètres

Aucun

### Réponse

```json
{
  "albums": [
    {
      "title": "Titre de l'album",
      "artist": ["Artiste"],
      "cover": "URL de la pochette",
      "lang": "Langue",
      "songLength": 10,
      "listenCount": 1000
    }
  ]
}
```

## Obtenir la couleur primaire d'une pochette

Extrait la couleur moyenne d'une URL de pochette d'album donnée.

```http
GET /albums/primary-color
```

### Paramètres de requête

| Nom      | Type   | Description                     |
|----------|--------|---------------------------------|
| coverURL | string | URL de la pochette de l'album   |

### Réponse

```json
{
  "betterDominantColor": "#HEXCODE"
}
```

## Obtenir des albums aléatoires

Renvoie 4 albums aléatoires de la base de données.

```http
GET /albums/random
```

### Paramètres

Aucun

### Réponse

```json
{
  "albums": [
    {
      "title": "Titre de l'album",
      "artist": ["Artiste"],
      "cover": "URL de la pochette",
      "lang": "Langue",
      "songLength": 10
    }
  ]
}
```

## Rechercher des chansons

Recherche des chansons dans tous les albums en fonction d'un terme de recherche.

```http
GET /albums/songs
```

### Paramètres de requête

| Nom  | Type   | Description        |
|------|--------|--------------------|
| song | string | Terme de recherche |

### Réponse

```json
{
  "songs": [
    {
      "title": "Titre de la chanson",
      "file": "URL du fichier audio",
      "albumTitle": "Titre de l'album",
      "albumArtist": ["Artiste"],
      "albumCover": "URL de la pochette",
      "albumLang": "Langue",
      "albumId": "ID de l'album"
    }
  ]
}
```

## Obtenir les albums par artiste

Renvoie les albums pour un artiste donné, plus une liste aléatoire de jusqu'à 6 chansons et le nombre total de chansons.

```http
GET /albums/artist/:artist
```

### Paramètres de chemin

| Nom    | Type   | Description     |
|--------|--------|-----------------|
| artist | string | Nom de l'artiste|

### Réponse

```json
{
  "albums": [
    {
      "_id": "ID de l'album",
      "title": "Titre de l'album",
      "artist": ["Artiste"],
      "cover": "URL de la pochette",
      "lang": "Langue",
      "songLength": 10
    }
  ],
  "artistRandomSongs": [
    {
      "title": "Titre de la chanson",
      "file": "URL du fichier audio",
      "albumTitle": "Titre de l'album",
      "albumArtist": ["Artiste"],
      "albumCover": "URL de la pochette",
      "albumLang": "Langue",
      "albumId": "ID de l'album"
    }
  ],
  "totalSongs": 100
}
```

## Obtenir les albums par genre

Renvoie les albums pour un genre spécifié, triés par titre normalisé.

```http
GET /albums/genre
```

### Paramètres de requête

| Nom   | Type   | Description    |
|-------|--------|----------------|
| genre | string | Genre musical  |

### Réponse

```json
{
  "albums": [
    {
      "title": "Titre de l'album",
      "artist": ["Artiste"],
      "cover": "URL de la pochette",
      "lang": "Langue",
      "genre": "Genre musical",
      "songLength": 10
    }
  ]
}
```

## Obtenir les albums les plus écoutés

Récupère les 8 albums les plus écoutés basés sur le nombre d'écoutes des utilisateurs.

```http
GET /albums/most-listened
```

### Paramètres

Aucun

### Réponse

```json
{
  "albums": [
    {
      "title": "Titre de l'album",
      "artist": ["Artiste"],
      "cover": "URL de la pochette",
      "lang": "Langue",
      "songLength": 10,
      "listenCount": 1000
    }
  ]
}
```

## Obtenir des albums aléatoires

Renvoie 4 albums aléatoires de la base de données.

```http
GET /albums/random
```

### Paramètres

Aucun

### Réponse

```json
{
  "albums": [
    {
      "title": "Titre de l'album",
      "artist": ["Artiste"],
      "cover": "URL de la pochette",
      "lang": "Langue",
      "songLength": 10
    }
  ]
}
```

## Rechercher des chansons

Recherche des chansons dans tous les albums en fonction d'un terme de recherche.

```http
GET /albums/songs
```

### Paramètres de requête

| Nom  | Type   | Description        |
|------|--------|--------------------|
| song | string | Terme de recherche |

### Réponse

```json
{
  "songs": [
    {
      "title": "Titre de la chanson",
      "file": "URL du fichier audio",
      "albumTitle": "Titre de l'album",
      "albumArtist": ["Artiste"],
      "albumCover": "URL de la pochette",
      "albumLang": "Langue",
      "albumId": "ID de l'album"
    }
  ]
}
```

## Obtenir la couleur primaire d'une pochette

Extrait la couleur moyenne d'une URL de pochette d'album donnée.

```http
GET /albums/primary-color
```

### Paramètres de requête

| Nom      | Type   | Description                     |
|----------|--------|---------------------------------|
| coverURL | string | URL de la pochette de l'album   |

### Réponse

```json
{
  "betterDominantColor": "#HEXCODE"
}
```