import express from "express";
import bodyParser from "body-parser";
import mysql from 'mysql2/promise';  // Use 'mysql2/promise' for async/await support
import cors from 'cors';
import multer from "multer";
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid'; // Importing uuidv4 using ES6 syntax

// Use import.meta.url to get the module's URL
const __filename = fileURLToPath(import.meta.url);
// Use dirname to get the directory name
const __dirname = dirname(__filename);

// Rest of your code here

const app = express();
const port = 4000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cors());
app.use(express.json());

// Specify the upload directory and filename
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/resumes');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Use createPool to handle multiple connections and support connection pooling
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Dileep@9123',
    database: 'momenthire',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0 
});

async function getUser() {
    try {
        const [rows] = await pool.execute('SELECT * FROM users');
        console.log(rows);
        return rows;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function addUser(user) {
    try {
        const [rows] = await pool.execute(
            'INSERT INTO users (email, full_name, phone_number, dob, gender, password) VALUES (?, ?, ?, ?, ?, ?);',
            [user.email, user.fName + ' ' + user.lName, user.phone, user.dob, user.gender, user.password]
        );
        console.log(rows);
        return rows;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

app.get("/", async (req, res) => {
    try {
        const users = await getUser();
        res.send(users);
    } catch (error) {
        res.status(500).send("Internal Server Error");
    }
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    console.log(email + " " + password);
    try {
        const [user] = await pool.execute('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);

        if (user.length > 0) {
            res.json(user[0]); // Return user data
        } else {
            res.status(401).send("Invalid credentials");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/register", async (req, res) => {
    const user = req.body;

    try {
        await addUser(user);
        res.status(200).send("successfull");
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            // Duplicate entry error (email already exists)
            res.status(400).send("Email already registered");
        } else {
            // Other errors
            console.error(error);
            res.status(500).send("Internal Server Error");
        }
    }
});

// ... (rest of your code)





app.post("/jobs", upload.single('resume'), async (req, res) => {
    try {
        console.log(req.file);
        console.log(req.body.email);
        console.log(req.body);

        if (!req.file) {
            return res.status(400).send('No resume file uploaded');
        }

        // Check if the record already exists
        const [existingRecord] = await pool.execute(
            'SELECT * FROM jobapplications WHERE email = ?;',
            [req.body.email]
        );
        
        console.log(existingRecord);
        if (existingRecord && existingRecord.length > 0) {
            // Update the existing record with new information
            await pool.execute(
                'UPDATE jobapplications SET phone_number=?, graduation_year=?, college_name=?, qualification=?, branch_of_study=?, skills=?, resume_path=?, company=?, designation=?, experience=? WHERE email=?;',
                [req.body.phonenumber, req.body.graduationYear, req.body.collegeName, req.body.qualification, req.body.branchOfStudy, req.body.skills, req.file.path,req.body.company, req.body.designation, req.body.experience, req.body.email]
            );

            // Delete the old resume from the server
             fs.unlink(existingRecord[0].resume_path, (err) => {
                if (err) {
                    console.error(err);
                    res.status(500).send(`Internal Server Error`);
                } else {
                    console.log('Old resume deleted successfully');
                }
            });

            res.status(200).send('User and resume data updated successfully');
        } else {
            // Insert a new record
            await pool.execute(
                'INSERT INTO jobapplications (email, phone_number, graduation_year, college_name, qualification, branch_of_study, skills, resume_path, company, designation, experience) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
                [req.body.email, req.body.phonenumber, req.body.graduationYear, req.body.collegeName, req.body.qualification, req.body.branchOfStudy, req.body.skills, req.file.path, req.body.company, req.body.designation, req.body.experience]
            );

            res.status(200).send('user and resume data uploaded successfully');
        }
    } catch (error) {
        fs.unlink(req.file.path, (err) => {
            if (err) {
                console.error(err);
            } else {
                console.log('resume deleted successfully');
            }
        });

        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_ROW_IS_REFERENCED') {
            // Handle foreign key violation
            res.status(400).send("User Not Found. Sign up to Apply");
        } else {
            // Handle other errors
            console.error(error);
            res.status(500).send("Internal Server Error");
        }
    }
});

app.post("/internships", upload.single('resume'), async (req, res) => {
    try {
        console.log(req.file);
        console.log(req.body.email);
        console.log(req.body);

        if (!req.file) {
            return res.status(400).send('No resume file uploaded');
        }

        // Check if the required properties exist in req.bod
        // Check if the record already exists
        const [existingRecord] = await pool.execute(
            'SELECT * FROM internship_applications WHERE email = ? AND intern_id = ?;',
            [req.body.email, req.body.intern_id]
        );

        console.log(existingRecord);
        if (existingRecord && existingRecord.length > 0) {
            // Update the existing record with new information
            await pool.execute(
                'UPDATE internship_applications SET phone_number=?, graduation_year=?, college_name=?, qualification=?, branch_of_study=?, skills=?, availability=?, resume_path=?, company=?, designation=?, experience=?  WHERE email=? AND intern_id=?;',
                [req.body.phonenumber, req.body.graduationYear, req.body.collegeName, req.body.qualification, req.body.branchOfStudy, req.body.skills, req.body.availability, req.file.path, req.body.company, req.body.designation, req.body.experience,  req.body.email, req.body.intern_id]
            );

            // Delete the old resume from the server
            fs.unlink(existingRecord[0].resume_path, (err) => {
                if (err) {
                    console.error(err);
                } else {
                    console.log('Old resume deleted successfully');
                }
            });

            res.status(200).send('Resume data updated successfully');
        } else {
            // Insert a new record
            await pool.execute(
                'INSERT INTO internship_applications (email, intern_id, phone_number, graduation_year, college_name, qualification, branch_of_study, skills, availability, resume_path, company, designation, experience) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
                [req.body.email, req.body.intern_id, req.body.phonenumber, req.body.graduationYear, req.body.collegeName, req.body.qualification, req.body.branchOfStudy, req.body.skills, req.body.availability, req.file.path,  req.body.company, req.body.designation, req.body.experience]
            );

            res.status(200).send('Resume data uploaded successfully');
        }
    } catch (error) {
        fs.unlink(req.file.path, (err) => {
            if (err) {
                console.error(err);
            } else {
                console.log('Resume deleted successfully');
            }
        });

        if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_ROW_IS_REFERENCED') {
            // Handle foreign key violation
            res.status(400).send("User Not Found. Sign up to Apply");
        } else {
            // Handle other errors
            console.error(error);
            res.status(500).send("Internal Server Error");
        }
    }
});



app.get("/internships/active_all", async (req, res) => {
    try {
        // Get current date
        const currentDate = new Date().toISOString().split('T')[0];

        // Fetch internships whose deadline is not expired
        const [internships] = await pool.execute(
            'SELECT * FROM internships WHERE deadline >= ?',
            [currentDate]
        );

        res.status(200).json(internships);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});


app.get("/jobs/resume/:email", async (req, res) => {
    try {
        const userEmail = req.params.email;
        // Fetch the resume path from the database based on the email
        const [result] = await pool.execute(
            'SELECT resume_path FROM jobapplications WHERE email = ?',
            [userEmail]
        );

        if (result.length === 0 || !result[0].resume_path) {
            return res.status(404).send('Resume not found');
        }

        const resumePath = result[0].resume_path;

       console.log(resumePath);

        // Send the resume file as a response
        res.sendFile(path.resolve(__dirname, '', resumePath));
    } catch (error) {
        console.error(error);
        res.status(500).send(`Internal Server Error: ${error.message}`);
    }
});

app.get("/internships/resume/:email", async (req, res) => {
    try {
        const userEmail = req.params.email;
        // Fetch the resume path from the database based on the email
        const [result] = await pool.execute(
            'SELECT resume_path FROM internship_applications WHERE email = ?',
            [userEmail]
        );

        if (result.length === 0 || !result[0].resume_path) {
            return res.status(404).send('Resume not found');
        }

        const resumePath = result[0].resume_path;

       console.log(resumePath);

        // Send the resume file as a response
        res.sendFile(path.resolve(__dirname, '', resumePath));
    } catch (error) {
        console.error(error);
        res.status(500).send(`Internal Server Error: ${error.message}`);
    }
});


app.get("/internships/upload", (req, res)=>{
   res.render("internship_upload.ejs");
});



app.post("/internships/upload", async (req, res) => {
    try {
        const {
            title,
            company,
            type,
            post_date,
            location,
            duration,
            start_date,
            stipend,
            openings,
            deadline
        } = req.body;

        // Generate a UUID for the internship ID
        const intern_id = uuidv4();

        // Insert data into the database
        await pool.execute(
            `INSERT INTO internships (intern_id, title, type, post_date, location, duration, start_date, stipend, openings, deadline, company) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [intern_id, title, type, post_date, location, duration, start_date, stipend, openings, deadline, company]
        );

        res.status(200).send('Internship data uploaded successfully');
    } catch (error) {
        if (error.code === 'ER_DATA_TOO_LONG') {
            // Handle data mismatch error (e.g., field length exceeds column length)
            res.status(400).send("Data mismatch: Some fields contain too much data");
        } else {
            // Handle other errors
            console.error(error);
            res.status(500).send("Internal Server Error");
        }
    }
});



    

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
