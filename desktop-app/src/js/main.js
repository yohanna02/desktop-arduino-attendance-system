const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const mongoose = require("mongoose");
const webSocket = require("ws");
const fs = require("fs");
const os = require("os");

const adminModel = require("../model/adminModel.js");
const classModel = require("../model/classModel.js");
const studentModel = require("../model/studentModel.js");
const sendMail = require("./sendMail.js");
const fingerModel = require("../model/fingerModel.js");

let loggedIn = false;
let currentClassId = null;
let currentStudentId = null;
let fingerprintId = null;

let port = null;

const template = [
  {
    label: "File",
    submenu: [{ role: "toggleDevTools" }, { role: "quit" }],
  },
  {
    label: "Disconnected",
  },
  {
    label: "Fingerprint Disconnected",
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

mongoose.connect("mongodb://localhost:27017/attendance-system", {
  useNewUrlParser: true,
});

let parent;
let child;
let studentAttendanceWindow;

const socketClient = new webSocket("ws://localhost:3000");

socketClient.on("open", () => {
  console.log("Conneced Web socket");

  socketClient.send(JSON.stringify({
    event: "set-device",
    device: "desktop"
  }));

  socketClient.on("message", (rawData) => {
    const data = JSON.parse(rawData.toString());

    if (data.event === "enroll") {
      child.webContents.send("enroll-id", data.id);
    }
  })
});

const db = mongoose.connection;
db.once("open", () => {
  template[1].label = "Connected";
  template.push({
    label: "Login",
    click: () => {
      child = createWindow(
        {
          width: 400,
          height: 250,
          parent,
          modal: true,
          menu: null,
          frame: false,
          webPreferences: {
            preload: path.join(__dirname, "preload.js"),
          },
        },
        path.join(__dirname, "../views/login.html")
      );
    },
  });
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

const createWindow = (options, file) => {
  const win = new BrowserWindow({
    ...options,
  });

  win.loadFile(file);
  return win;
};

app.on("ready", () => {
  parent = createWindow(
    {
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    },
    path.join(__dirname, "../views/index.html")
  );

  // parent.webContents.openDevTools();

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.on("login", (message, data) => {
  adminModel
    .findOne({ email: data.email })
    .then((adminData) => {
      if (adminData.password == data.password) {
        loggedIn = true;
        child.close();
        child = null;
      } else {
        child.webContents.send("msg", "Incorrect email or password");
      }
    })
    .catch(() => {
      parent.webContents.send("msg", "Error Logging in");
    });
});

ipcMain.on("closeLogin", () => {
  child.close();
  child = null;
});

ipcMain.on("add-class", (event, data) => {
  if (!loggedIn) {
    parent.webContents.send("msg", "Log in please");
    return;
  }
  const newClass = new classModel({
    name: data,
  });

  newClass.save().then((data) => {
    parent.webContents.send("msg", "Added class successfully");
  });
});

ipcMain.handle("fetchClass", async () => {
  try {
    if (!loggedIn) {
      return {
        success: false,
        msg: "Log in please",
      };
    }
    const classes = await classModel.find();
    return {
      success: true,
      classes: JSON.stringify(classes),
    };
  } catch (err) {
    return {
      error: true,
      msg: "Error Fetching class list",
    };
  }
});

ipcMain.on("viewStudents", (event, classId) => {
  child = createWindow(
    {
      width: 800,
      height: 600,
      parent,
      modal: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    },
    path.join(__dirname, "../views/students.html")
  );
  currentClassId = classId;
});

ipcMain.handle("studentData", async () => {
  if (!currentClassId) {
    return {
      success: false,
      msg: "Error Fetching list of student",
    };
  }
  const _class = await classModel.findById(currentClassId);
  const students = await studentModel.find({_id: {
    $in: _class.studentsIds
  }});

  const newData = students.map(async (student) => {
    const _class = await classModel.findOne({
      _id: currentClassId,
      studentsIds: {
        $in: student.id
      }
    });

    const len = _class.attendance.length;
    let classAttended = 0;
    for (let i = 0; i < len; i++) {
      if (_class.attendance[i].studentIds.includes(student.id)) {
        classAttended++;
      }
    }
    let myStudent = JSON.stringify(student);
    myStudent = JSON.parse(myStudent);
    const data = {
      ...myStudent,
      totalAttendance: len,
      classAttended
    }
    return data;
  });

  const resolve = await Promise.all(newData);


  return {
    success: true,
    class: _class.name,
    students: JSON.stringify(resolve),
  };
});

ipcMain.on("add-student", (event, data) => {
  const addStudent = async () => {
    try {
      const _class = await classModel.findById(currentClassId);
      if (!_class) {
        parent.webContents.send("msg", "Invalid class Id");
        return;
      }

      const student = await studentModel.findOne({fingerprintId: data.fingerprintId});
      if (student) {
        parent.webContents.send("msg", "Fingerprint ID already in use");
        return;
      }
      const newStudent = new studentModel({
        name: data.name,
        regNo: data.regNo,
        parentEmail: data.parentEmail,
        fingerprintId: data.fingerprintId
      });

      const saved = await newStudent.save();

      _class.studentsIds.push(saved._id);
      await _class.save();

      await fingerModel.create({
        fingerprintId: data.fingerprintId
      });

      parent.webContents.send("msg", "Added new student");
    } catch (err) {
      parent.webContents.send("msg", "An error occured while adding student");
    }
  }
  addStudent();
});

ipcMain.on("make-attendance", (event, classId) => {
  classModel
    .findOne({ _id: classId, "attendance.open": true })
    .then((attendance) => {
      if (attendance) {
        parent.webContents.send("msg", "Attendance is already open");
        return null;
      }

      return classModel.findById(classId);
    })
    .then((_class) => {
      if (_class) {
        _class.attendance.push({
          open: true,
          studentIds: [],
        });

        return _class.save();
      }
    })
    .then((saved) => {
      if (saved) {
        parent.webContents.send("msg", "Attendance Created successfully");
      }
    })
    .catch(() => {
      parent.webContents.send("msg", "Error creating attendance");
    });
});

ipcMain.on("close-attendance", (event, classId) => {
  const closeAttendance = async () => {
    try {
      const _class = await classModel.findOne({ _id: classId, "attendance.open": true });
      if (!_class) {
        parent.webContents.send("msg", "Attendance is not open");
        return;
      }
      const len = _class.attendance.length;
      let absent = [];
      for (let i = 0; i < len; i++) {
        if (_class.attendance[i].open) {
          absent = _class.studentsIds
            .filter(
              (studentId) =>
                _class.attendance[i].studentIds.indexOf(studentId) === -1
            )
          _class.attendance[i].open = false;
          break;
        }
      }
      await _class.save();

      const absentStudentParentEmail = await studentModel.find({_id: {
        $in: absent
      }}).select("parentEmail");
      
      const mappedAbsentStudentParentEmail = absentStudentParentEmail.map(student => student.parentEmail);

      const html = `
      <p>Dear Parent</p>
      <p>Your child was absent for his/her ${_class.name} today?</p>
      `;
      await sendMail(mappedAbsentStudentParentEmail, "Absent Resport", html);
      parent.webContents.send("msg", "Attendance closed successfully");
    } catch (err) {
      parent.webContents.send("msg", "Error closing attendance");
    }
  }
  closeAttendance();
});

ipcMain.on("open-student-attendance", (event, studentId) => {
  currentStudentId = studentId;
  studentAttendanceWindow = createWindow(
    {
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
      modal: true,
      parent: child
    },
    path.join(__dirname, "../views/studentAttendance.html")
  );
});

ipcMain.handle("view-attendance", async (event) => {
  try {
    const _class = await classModel.findOne({
      _id: currentClassId,
      studentsIds: {
        $in: currentStudentId
      },
    });

    const student = await studentModel.findById(currentStudentId);

    // const attendance = _class.studentsIds.map(async (student) => {
    let totalAttendance = [];
    _class.attendance.forEach(attendance => {
      if (attendance.studentIds.includes(currentStudentId)) {
        totalAttendance.push({
          date: attendance.date,
          present: true
        });
      }
      else {
        totalAttendance.push({
          date: attendance.date,
          present: false
        });
      }
    });
    
    let myStudent = JSON.stringify(student);
    myStudent = JSON.parse(myStudent);

    return {
      success: true,
      className: _class.name,
      ...myStudent,
      totalAttendance
    };
  } catch (err) {
    return {
      success: false,
      msg: "Error fetching Attendance"
    }
  }
});

ipcMain.on("print-page", (event) => {
  const pdfPath = path.join(os.homedir(), "Desktop", "attendance.pdf");
  studentAttendanceWindow.webContents.printToPDF({}).then(data => {
    fs.writeFile(pdfPath, data, (error) => {
      if (error) {
        studentAttendanceWindow.webContents.send("msg", "Failed to write PDF");
        return;
      };
      studentAttendanceWindow.webContents.send("msg", "File saved");
    });
  }).catch(error => {
    studentAttendanceWindow.webContents.send("msg", "Failed to write PDF");
  });
});
