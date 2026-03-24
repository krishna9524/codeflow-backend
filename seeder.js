const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

const Course = require('./models/Course');
const Topic = require('./models/Topic');
const Question = require('./models/Question');
const Admin = require('./models/Admin');

mongoose.connect(process.env.MONGO_URI);

const importData = async () => {
  try {
    const admin = await Admin.findOne();
    if (!admin) {
      console.error('No admin user found. Please create an admin user first.');
      process.exit(1);
    }
    const adminId = admin._id;

    const questionsToImport = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'questions.json'), 'utf-8')
    );

    const processedQuestions = await Promise.all(questionsToImport.map(async (q) => {
        const course = await Course.findOne({ title: q.courseName });
        const topic = await Topic.findOne({ title: q.topicName, course: course?._id });

        if (!course || !topic) {
            console.warn(`Skipping question "${q.title}" due to missing course or topic.`);
            return null;
        }

        return {
            title: q.title,
            description: q.description,
            difficulty: q.difficulty,
            course: course._id,
            topic: topic._id,
            createdBy: adminId,
            sampleTestCases: q.sampleTestCases || [],
            hiddenTestCases: q.hiddenTestCases || [],
            solutions: q.solutions || [],
            starter_cpp: q.starter_cpp || '',
            starter_java: q.starter_java || '',
            starter_python: q.starter_python || '',
            driver_cpp: q.driver_cpp || '',
            driver_java: q.driver_java || '',
            driver_python: q.driver_python || '',
        };
    }));
    
    const validQuestions = processedQuestions.filter(q => q !== null);

    if (validQuestions.length > 0) {
        // --- FIX IS HERE ---
        // Query against the 'title' field, not the '_id' field.
        await Question.deleteMany({ title: { $in: validQuestions.map(q => q.title) } });
        // --- END FIX ---

        await Question.insertMany(validQuestions);
        console.log(`✅ ${validQuestions.length} Questions Imported!`);
    } else {
        console.log('No valid questions found to import.');
    }

    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const deleteData = async () => {
  try {
    await Question.deleteMany();
    console.log('🔥 All Questions Destroyed!');
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const exportData = async () => {
  try {
    const questionsFromDB = await Question.find()
      .populate('course', 'title')
      .populate('topic', 'title');

    const formattedQuestions = questionsFromDB.map(q => {
      return {
        title: q.title,
        description: q.description,
        difficulty: q.difficulty,
        courseName: q.course?.title,
        topicName: q.topic?.title,
        starter_cpp: q.starter_cpp,
        starter_java: q.starter_java,
        starter_python: q.starter_python,
        driver_cpp: q.driver_cpp,
        driver_java: q.driver_java,
        driver_python: q.driver_python,
        sampleTestCases: q.sampleTestCases.map(tc => ({ input: tc.input, output: tc.output })),
        hiddenTestCases: q.hiddenTestCases.map(tc => ({ input: tc.input, output: tc.output })),
        solutions: q.solutions.map(sol => ({
            language: sol.language,
            approach: sol.approach,
            explanation: sol.explanation,
            code: sol.code,
        })),
      };
    });

    const filePath = path.join(__dirname, 'data', 'questions.json');
    fs.writeFileSync(filePath, JSON.stringify(formattedQuestions, null, 2));

    console.log(`✅ Data exported! ${formattedQuestions.length} questions saved to data/questions.json`);
    process.exit();
  } catch (error) {
    console.error('❌ Error exporting data:', error);
    process.exit(1);
  }
};

if (process.argv[2] === '-i') {
  importData();
} else if (process.argv[2] === '-d') {
  deleteData();
} else if (process.argv[2] === '-e') {
  exportData();
} else {
  console.log("Please use the flag '-i' to import, '-d' to destroy, or '-e' to export data.");
  process.exit();
}