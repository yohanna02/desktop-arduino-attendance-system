const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const mongoose = require("mongoose");
const { SerialPort } = require("serialport");

const adminModel = require("../model/adminModel.js");
const classModel = require("../model/classModel.js");
const sendMail = require("./sendMail.js");

let loggedIn = true;
let currentClassId = null;
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

let timer = null;
const checkForFingerprintDevice = async () => {
  const _port = await SerialPort.list();
  const connect = _port.find((p) => {
    return p.vendorId === "1a86" && p.productId === "7523";
  });

  if (connect) {
    clearInterval(timer);
    port = new SerialPort(
      {
        path: connect.path,
        baudRate: 115200,
      },
      (err) => {
        if (err) {
          console.log(err);
          parent.webContents.send("msg", "Error connecting to fingerprint");
          return;
        }

        template[2].label = "Fingerprint Connected";
        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
      }
    );

    port.on("data", (data) => {
      child2.webContents.send("enroll-res", data.toString());
    });
  }
};

timer = setInterval(checkForFingerprintDevice, 2000);

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

mongoose.connect("mongodb://localhost/attendance-system", {
  useNewUrlParser: true,
});

let parent;
let child;
let child2;

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
  return {
    success: true,
    class: _class.name,
    students: JSON.stringify(_class.students),
  };
});

ipcMain.on("openEnroll", (event, printId) => {
  child2 = createWindow(
    {
      width: 400,
      height: 500,
      parent: child,
      modal: true,
      menu: null,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    },
    path.join(__dirname, "../views/finger.html")
  );
  fingerprintId = printId;
});

ipcMain.on("enroll", () => {
  classModel
    .findOne({ _id: currentClassId, "students.fingerprintId": fingerprintId })
    .then((exist) => {
      if (exist) {
        parent.webContents.send("msg", "Fingerprint Id in use");
        return;
      }

      port.write(`enroll:${fingerprintId}`, (err) => {
        if (err) {
          console.log(err);
          parent.webContents.send("msg", "Error trying to enroll student");
          return;
        }
      });
    });
});

ipcMain.on("add-student", (event, data) => {
  classModel
    .findById(currentClassId)
    .then((_class) => {
      if (!_class) {
        parent.webContents.send("msg", "Invalid class Id");
        return;
      }

      _class.students.push(data);
      return _class.save();
    })
    .then(() => {
      parent.webContents.send("msg", "Added new student");
    })
    .catch(() => {
      parent.webContents.send("msg", "An error occured while adding student");
    });
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
  classModel
    .findOne({ _id: classId, "attendance.open": true })
    .then((_class) => {
      if (!_class) {
        parent.webContents.send("msg", "Attendance is not open");
        return null;
      }

      const len = _class.attendance.length;
      let absent = [];
      for (let i = 0; i < len; i++) {
        if (_class.attendance[i].open) {
          absent = _class.students
            .filter(
              (student) =>
                _class.attendance[i].studentIds.indexOf(student.id) === -1
            )
            .map((student) => student.parentEmail);
          _class.attendance[i].open = false;
          break;
        }
      }

      const html = `
     <p>Dear Parent</p>
     <p>Your child was absent for his/her ${_class.name} today?</p>
    `;
      sendMail(absent, "Absent Resport", html);

      return _class.save();
    })
    .then((saved) => {
      if (saved) {
        parent.webContents.send("msg", "Attendance closed successfully");
      }
    })
    .catch((err) => {
      console.log(err);
      parent.webContents.send("msg", "Error closing attendance");
    });
});

ipcMain.on("take-attendance", (event, studentId) => {
  classModel
    .findOne({
      _id: currentClassId,
      "students._id": studentId,
      "attendance.open": true,
    })
    .then((_class) => {
      if (!_class) {
        parent.webContents.send("msg", "No avaliable attendance");
        return;
      }

      const len = _class.attendance.length;
      for (let i = 0; i < len; i++) {
        if (
          _class.attendance[i].open &&
          !_class.attendance[i].studentIds.includes(studentId)
        ) {
          _class.attendance[i].studentIds.push(studentId);
          return _class.save();
        }
      }

      return null;
    })
    .then((saved) => {
      if (saved) {
        parent.webContents.send("msg", "Attendance Taken");
        return;
      }

      parent.webContents.send("msg", "Attendance Already Taken");
    })
    .catch(() => {
      parent.webContents.send("msg", "Error taking attendance");
    });
});

ipcMain.handle("view-attendance", async (event, studentId) => {
  try {
    const _class = await classModel.findOne({
      _id: currentClassId,
      "students._id": studentId,
    });

    if (!_class) {
      return {
        success: false,
        msg: "Invalid class Id"
      };
    }

    const len = _class.attendance.length;
    let classAttended = 0;
    for (let i = 0; i < len; i++) {
      if (_class.attendance[i].studentIds.includes(studentId)) {
        classAttended++;
      }
    }

    return {
      success: true,
      totalAttendance: len,
      classAttended
    };
  } catch (err) {
    return {
      success: false,
      msg: "Error fetching Attendance"
    }
  }
});
