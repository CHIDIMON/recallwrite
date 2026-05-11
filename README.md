# Recall Write: Gemini & Medium Style Note App

Recall Write is a minimalist, It features a rich text editor (QuillJS), folder organization with drag-and-drop, pinned notes, a trash bin for soft deletes, and responsive design for mobile.

The application is built with FastAPI (Python) for the backend and Vanilla JavaScript, HTML, and CSS for the frontend. Data is stored locally using SQLite, and images are managed directly on the server's file system.

## Features

-   **Rich Text Editing:** Bold, Italic, Underline, Strikethrough, Text Color, Highlight, Headings (custom sizes), Blockquotes, Code Blocks, Links, Lists.
-   **Image Management:** Upload and paste images directly into notes. Images can be freely dragged and resized within the editor.
-   **Folder Organization:** Create nested folders with drag-and-drop functionality for notes and folders.
-   **Pinned Notes:** Pin important notes to the top of their respective folders.
-   **Trash Bin:** Soft delete notes to a trash bin, with options to restore or permanently delete.
-   **Auto-Save:** Notes are automatically saved when switching notes, creating new notes, or closing the browser.
-   **Timestamps:** Displays creation and last edited times for each note.
-   **Search & Sort:** Search notes by title or folder name, and sort by creation/update date.
-   **Responsive UI:** Optimized for both desktop and mobile devices.
-   **Dockerized:** Easy setup and consistent environment across different machines.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You need to have [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed on your machine. Docker Desktop includes Docker Engine and Docker Compose.

### Installation

1.  **Clone the repository:**
    First, clone the project from GitHub to your local machine:
    ```bash
    git clone https://github.com/your-username/recall-write.git # Replace with your actual repo URL
    cd recall-write
    ```

2.  **Run the Application with Docker Compose:**
    Navigate into the project directory and start the application using Docker Compose.

    a.  **Start Docker Desktop:**
        Ensure that Docker Desktop is running on your machine.

    b.  **Build and Start Services (First-time setup or after Backend/Dependency changes):**
        Use this command when you first set up the project, or whenever you've made changes to Python code (`.py` files), `uv.lock`, or the `Dockerfile`. This will build the Docker image and then start the services.
        ```bash
        docker compose up -d --build
        ```
        -   `up`: Starts the services defined in `docker-compose.yml`.
        -   `-d`: Runs the containers in detached mode (in the background).
        -   `--build`: Builds the Docker images before starting the containers.

    c.  **Start Services (For subsequent runs or after Frontend-only changes):**
        If you've already built the image and only made changes to frontend files (HTML, CSS, JS), you can simply run this command. It will start the services without rebuilding the image.
    ```bash
    docker compose up -d
    ```
    -   **Note on Port Conflicts:** If you encounter an error like `Bind for 0.0.0.0:8000 failed: port is already allocated`, it means another program (or a previous instance of FastAPI) is using port 8000. You'll need to stop that program or change the port in `docker-compose.yml`.

3.  **Access the Application:**
    Once the containers are up and running, open your web browser and go to:
    ```
    http://localhost:8000
    ```

### Stopping the Application

To stop the application and remove the containers (but keep your data files `recall_v2.db` and `uploads/` on your host machine):
```bash
docker compose down
```

### Image Cleanup Script

The backend automatically runs a cleanup script (`cleanup_images.py`) every time the server starts. This script scans for any image files in the `uploads/` directory that are no longer referenced by any note in the database and deletes them, preventing orphaned files from consuming disk space.

---

Enjoy your new note-taking experience!
