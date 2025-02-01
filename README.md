# Audio Collection Manager API

> A Koa-based TypeScript backend for managing Albums, Playlists, User accounts, and more. This repository showcases a layered architecture with Controllers, Services, Models, and utility functions to create a maintainable and scalable music streaming API.

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Environment Variables](#environment-variables)
- [API Routes](#api-routes)
- [Technologies Used](#technologies-used)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

This Node.js and TypeScript application, built with the [Koa](https://koajs.com/) framework, provides a backend service for a music streaming or library platform. It includes user registration and authentication, playlist management, album management, and advanced features like recommendation algorithms and “wrapped” yearly stats. The code is organized into cohesive modules, making it simpler to extend or customize.

---

## Key Features

1. **User Management**  
   - Registration and login with JWT-based authentication.
   - Profile updates, password changes, account deletion.
   - Favorite album management (add/remove).

2. **Album Management**  
   - Retrieve albums, search by title or artist, and filter by genre.
   - Fetch artist summaries (total songs, total albums).
   - Access most-listened albums, random selections, and color extraction from album covers.

3. **Playlist Management**  
   - Create playlists, add/remove/reorder songs, toggle privacy.
   - “Favorite” playlist logic for quickly toggling favorite songs.

4. **Recommendations & Listening Stats**  
   - Track listening data (songs and albums) for personalized recommendations.
   - “Wrapped” endpoint for yearly stats, top songs/albums, and percentile-based performance.

5. **Security & Validation**  
   - JWT authentication middleware.
   - Validation with Joi for request bodies.
   - Sanitization to prevent NoSQL injection.

---

## Project Structure

The repository maintains a clear, multi-layered architecture:

```
.
├── controllers/          # Koa controllers for handling HTTP requests
├── dto/                  # Data Transfer Objects (Joi validation schemas)
├── interfaces/           # TypeScript interfaces defining domain data shapes
├── middlewares/          # Koa middlewares (e.g., auth checks)
├── models/               # MongoDB schemas and Mongoose models
├── modules/              # Grouping controllers and services (dependency injection style)
├── routes/               # Router definitions with Koa-Router
├── services/             # Business logic separate from HTTP layer
├── utils/                # Common utilities (auth, sanitization, etc.)
└── index.ts              # The main server startup file
```

Highlights of each folder:
- **controllers**: Receive HTTP requests and delegate to the appropriate service.  
- **services**: Contain business logic, data transformations, and coordinate with Mongoose models.  
- **models**: Schema definitions for MongoDB collections (e.g., `AlbumModel`, `UserModel`).  
- **routes**: Define REST endpoints using `koa-router`.  
- **utils**: Shared helper functions for authentication, formatting, or sanitization.

---

## Installation

1. **Clone the Repository**  
   ```bash
   git clone https://github.com/atomkernel0/audio-collection-manager-api.git
   cd your-project
   ```

2. **Install Dependencies**  
   ```bash
   bun install
   ```
   or
   ```bash
   npm install
   ```

3. **Set Up Environment Variables** (see [Environment Variables](#environment-variables) below).

4. **Start the Server**  
   ```bash
   bun start
   ```
   or
   ```bash
   npm start
   ```
   The application will run on the port configured in your `.env` (default is `3000`).

---

## Usage

- **Development**:  
  ```bash
  bun run dev # or npm
  ```

## Environment Variables

Create a `.env` file in the repository root (or configure via your deployment platform). The most critical variables are:

```plaintext
MONGO_DB_URI=        # MongoDB connection URI
JWT_SECRET=          # Secret key for JWT tokens
CDN_URL=             # The base URL for serving album covers
HCAPTCHA_TOKEN=      # Secret key for hCaptcha verification
PORT=                # Server port (optional, default: 3000)
NODE_ENV=            # Environment (development/production)
API_PREFIX=          # Prefix for all routes (e.g., /api)
```

Make sure to adjust these to match your environment.

---

## API Routes

Below is a quick reference to some of the endpoints defined in the `routes/` directory. Each route uses a prefix from `API_PREFIX` in `.env`:

| Route Path                                   | Description                                     |
|---------------------------------------------|-------------------------------------------------|
| **Auth**                                    |                                                 |
| POST `/auth/register`                      | User registration with hCaptcha validation      |
| POST `/auth/login`                         | User login, returns JWT token                   |
| **Users**                                   |                                                 |
| GET `/users/me`                            | Fetch current user info, requires JWT           |
| PATCH `/users/username`                    | Change username, requires JWT                   |
| PATCH `/users/password`                    | Change password, requires JWT                   |
| DELETE `/users`                            | Delete user account, requires JWT               |
| **Albums**                                  |                                                 |
| GET `/albums`                              | Get all albums (1-day cached)                   |
| GET `/albums/album?albumId=xxx`            | Get details for a single album by ID            |
| GET `/albums/search?q=Term`                | Fuzzy search for albums by title or artist      |
| GET `/albums/random`                       | Get 4 random albums                             |
| GET `/albums/genre?genre=RAC`              | Get albums filtered by genre                    |
| **Playlists**                               |                                                 |
| GET `/playlists`                           | Get user’s playlists, requires JWT              |
| POST `/playlists`                          | Create a new playlist or add a song, JWT        |
| PATCH `/playlists/:playlistId`             | Rename playlist, JWT                            |
| DELETE `/playlists/:playlistId`            | Delete playlist, JWT                            |
| **Wrapped**                                 |                                                 |
| GET `/wrapped/get-wrapped`                 | Retrieve yearly stats, top songs/albums, etc.   |

For detailed usage, refer to each controller or the code inline documentation.

More detailed documentation : (in French)

[album.docs.md](./docs/album.docs.md)

[user.docs.md](./docs/user.docs.md)

---

## Technologies Used

- **Node.js / TypeScript** for server-side scripting.  
- **Koa** as the HTTP framework.  
- **Mongoose** for MongoDB interactions.  
- **Joi** for request payload validation.  
- **JWT** for user authentication.  
- **Pino** for logging.  
- **Axios** for external API calls (e.g., hCaptcha).  

---

## Contributing

1. Fork the repository.  
2. Create a new feature branch: `git checkout -b feature/new-feature`.  
3. Commit changes: `git commit -am 'Add new feature'`.  
4. Push the branch: `git push origin feature/new-feature`.  
5. Create a Pull Request.  

We welcome any improvements or bug fixes that help make this code more robust or easier to maintain.

---

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0). 

---

**Thank you for checking out this repository!** If you have any questions or issues, please open an issue or a pull request. We appreciate your contributions.