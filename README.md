<<<<<<< HEAD
# CodeFlow Backend

This is the backend for the CodeFlow platform, a LeetCode-inspired website for practicing coding problems.

## Features

-   User & Admin Authentication (JWT)
-   CRUD for Courses and Questions
-   Secure code execution using Judge0 API for C++, Java, and Python.
-   Problem submission with hidden test cases.
-   Playground for running arbitrary code with custom input.

## Setup Instructions

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd codeflow-backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create a `.env` file** in the root of the `codeflow-backend` directory and add the following variables:
    ```ini
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret
    PORT=5000

    # Admin credentials for initial setup
    ADMIN_EMAIL=krishna97360@gmail.com
    ADMIN_PASSWORD=Krishna987@

    # Judge0 API Credentials from RapidAPI
    RAPIDAPI_JUDGE0_URL=[https://judge0-ce.p.rapidapi.com](https://judge0-ce.p.rapidapi.com)
    RAPIDAPI_KEY=your_rapidapi_key
    RAPIDAPI_HOST=judge0-ce.p.rapidapi.com
    ```
    *Get your `RAPIDAPI_KEY` from [RapidAPI](https://rapidapi.com/judge0-official/api/judge0-ce).*

4.  **Run the server:**
    * For development (with auto-reloading):
        ```bash
        npm run dev
        ```
    * For production:
        ```bash
        npm start
        ```

The API will be available at `http://localhost:5000`. The initial admin account will be created automatically on the first run.
=======
# codeflow-backend
>>>>>>> 108415960ac923d449a0779d48bc24c40cdbe35f
