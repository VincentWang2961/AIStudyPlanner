# My Backend Project

## Overview
This project is a backend application designed to manage study plans, course units, and chat functionalities. It uses TypeScript and Express.js to provide API endpoints for planning, unit lookups, chat interactions, and handbook scraping.

## Features
- **Planning Functionalities**: Generate and evaluate study plans based on user input and course availability.
- **Chat Functionalities**: Interact with users through a chat interface.
- **Unit Management**: Manage course units, including prerequisites and corequisites.
- **Data Scraping**: Scrape handbook data to keep course information up to date.
- **Exporting Data**: Export data to Excel and PDF formats for reporting.

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd backend
   ```
3. Install dependencies:
   ```
   npm install
   ```

## Configuration
- Create a `.env` file based on `.env.example`.
- Configure database settings for your environment.

## Running the Application
Start the backend API:
```
npm start
```

## Running the Scraper
Run the handbook scraper locally:
```
npm run scrape
```

This command executes `src/scraper/runScraper.ts` and writes output to `backend/data/courses.json`.

## Testing
Run tests with:
```
npm test
```

## Contributing
Contributions are welcome. Please open an issue or submit a pull request for enhancements and bug fixes.

## License
This project is licensed under the MIT License.

