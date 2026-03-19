# My Backend Project

## Overview
This project is a backend application designed to manage study plans, course units, and chat functionalities. It utilizes TypeScript and Express.js to provide a robust API for users to interact with.

## Features
- **Planning Functionalities**: Generate and evaluate study plans based on user input and course availability.
- **Chat Functionalities**: Interact with users through a chat interface, providing assistance and information.
- **Unit Management**: Manage course units, including their prerequisites and corequisites.
- **Data Scraping**: Scrape data from external sources to keep course information up to date.
- **Exporting Data**: Export data to Excel and PDF formats for reporting purposes.

## Directory Structure
```
my-backend-project
├── src
│   ├── index.ts
│   ├── app.ts
│   ├── controllers
│   │   └── index.ts
│   ├── routes
│   │   └── index.ts
│   ├── services
│   │   └── index.ts
│   ├── models
│   │   └── index.ts
│   ├── repositories
│   │   └── index.ts
│   ├── middlewares
│   │   └── index.ts
│   ├── config
│   │   └── index.ts
│   └── utils
│       └── index.ts
├── test
│   └── example.test.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd my-backend-project
   ```
3. Install dependencies:
   ```
   npm install
   ```

## Configuration
- Create a `.env` file based on the `.env.example` file to set up environment variables.
- Configure the database connection in `src/config/database.ts`.

## Running the Application
To start the application, run:
```
npm start
```

## Testing
To run tests, use:
```
npm test
```

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.