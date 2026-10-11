# Professional Tax Challan Management System

A separate web application for maintaining a Professional Tax register, managing taxpayer records, exporting Excel files, and generating three-copy PDF challans.

## Features
- Dashboard totals for taxpayer count, current-year amount, arrears, and total assessed tax.
- Add and edit taxpayer records; search by business name, category, or serial number.
- Total Amount is calculated as Current Year Amount + Arrears Amount.
- Import Excel (.xlsx, .xls) or CSV and export the register to Excel.
- Generate a PDF with Bank, Department, and Taxpayer copies side by side on one landscape A4 page.
- PostgreSQL storage for shared records when multiple computers use the same hosted API and database.

## Requirements
- Node.js 20 or newer
- PostgreSQL database

## Run on Windows
1. Download or clone this repository.
2. Open Command Prompt in the project folder.
3. Run npm install.
4. Create a PostgreSQL database named professional_tax.
5. Copy .env.example to .env and enter your database connection details in DATABASE_URL.
6. Run npm run dev.
7. Open http://localhost:3000.

The React interface runs on port 3000 and the API runs on port 4000. Set VITE_API_URL to your deployed API URL if the frontend and backend are hosted separately.

## Shared database for multiple computers
Use a hosted PostgreSQL database and deploy the API server to a server that all authorized users can reach. Set DATABASE_URL on the API host. Do not share the database password or commit the real .env file to GitHub. A hosted database alone is not sufficient: the API must also be deployed and protected.

## Excel import
The first worksheet should contain column headers. Recognized headings include Sr No, Business Name, Category, Sub Category, Financial From & To, Current Year Amount (also accepts Cr Year Amount), Arrears Amount (also accepts Ars Amount), and Last Date. Total Amount is recalculated by the database. Existing serial numbers are updated on import.

## Challan template
The generated PDF currently provides three copies side by side. It is a starter layout, not yet verified against your official Word mail-merge document. Upload the actual Excel register and Word challan template so the fields, wording, and layout can be matched accurately.

## Deployment security
Before using official taxpayer records, deploy behind authentication and HTTPS, configure database backups, and restrict access to trusted users. Do not put production credentials in source control.
