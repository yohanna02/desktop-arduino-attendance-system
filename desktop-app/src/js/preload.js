const { contextBridge, ipcRenderer, BrowserWindow } = require("electron");

contextBridge.exposeInMainWorld("api", {
  login: (data) => {
    ipcRenderer.send("login", data);
  },
  closeLogin: () => {
    ipcRenderer.send("closeLogin");
  },
  msg: () => {
    ipcRenderer.on("msg", (event, message) => {
      alert(message);
    });
  },
  addClass: (data) => {
    ipcRenderer.send("add-class", data);
  },
  fetchClass: () => {
    ipcRenderer
      .invoke("fetchClass")
      .then((data) => {
        if (!data.success) {
          alert(data.msg);
          return;
        }

        const tableBody = document.querySelector("#table-body");
        const parsedClasses = JSON.parse(data.classes);

        tableBody.innerHTML = "";
        parsedClasses.forEach((_class, idx) => {
          const html = `
          <tr>
            <th scope="row">${idx + 1}</th>
            <td>${_class.name}</td>
            <td>${_class.studentsIds.length}</td>
            <td><button class="btn btn-primary" data-type="view students" data-classid="${
              _class._id
            }">View Students</button></td>
            <td><button class="btn btn-primary" data-type="make attendance" data-classid="${
              _class._id
            }">Make new Attendance</button></td>
            <td><button class="btn btn-danger" data-type="close attendance" data-classid="${
              _class._id
            }">Close Attendance</button></td>
          </tr>
        `;

          tableBody.innerHTML += html;
        });
      })
      .catch((err) => {
        console.log(err);
        alert("Error Fetching classes");
      });
  },
  viewStudents: (classId) => {
    ipcRenderer.send("viewStudents", classId);
  },
  studentData: () => {
    ipcRenderer
      .invoke("studentData")
      .then((data) => {
        if (!data.success) {
          alert(data.msg);
          return;
        }

        document.querySelector("h1").textContent = data.class;
        const tableBody = document.querySelector("#table-body");
        const parsedStudents = JSON.parse(data.students);

        tableBody.innerHTML = "";
        parsedStudents.forEach((student, idx) => {
          const html = `
          <tr>
            <th scope="row">${idx + 1}</th>
            <td>${student.name}</td>
            <td>${student.regNo}</td>
            <td>${student.parentEmail}</td>
            <td>${student.classAttended}/${student.totalAttendance}</td>
            <td><button class="btn btn-primary" data-type="view attendance" data-id="${
              student._id
            }">View Attendances</button></td>
          </tr>
        `;

          tableBody.innerHTML += html;
        });
      })
      .catch((err) => {
        console.log(err);
        alert("Error Fetching Student List");
      });
  },
  addNewStudent: (data) => {
    ipcRenderer.send("add-student", data);
  },
  makeAttendance: (classId) => {
    ipcRenderer.send("make-attendance", classId);
  },
  closeAttendance: (classId) => {
    ipcRenderer.send("close-attendance", classId);
  },
  // takeAttendance: (studentId) => {
  //   ipcRenderer.send("take-attendance", studentId);
  // },
  openAttendance: (studentId) => {
    ipcRenderer.send("open-student-attendance", studentId);
  },
  viewAttendance: () => {
    ipcRenderer.invoke("view-attendance").then((data) => {
      if (data.success) {
        const nameField = document.querySelector("#name");
        const regNoField = document.querySelector("#regNo");
        const classNameField = document.querySelector("#className");
        const tableBody = document.querySelector("#table-body");

        nameField.textContent = data.name;
        regNoField.textContent = data.regNo;
        classNameField.textContent = data.className;

        data.totalAttendance.forEach((attendance, idx) => {
          const date = new Date(attendance.date);
          const dateString = date.toLocaleString("en-NG", {
            dateStyle: "medium",
            timeStyle: "short"
          });
          const attended = attendance.present ? "Present" : "Absent";
          const html = `
          <tr>
            <th scope="row">${idx + 1}</th>
            <td>${dateString}</td>
            <td>${attended}</td>
          </tr>
        `;

          tableBody.innerHTML += html;
        });
      }
    });
  },
  print: () => {
    ipcRenderer.send("print-page");
  },
  enrollId: () => {
    ipcRenderer.on("enroll-id", (event, id) => {
      document.querySelector("#fingerId").value = id;
    });
  },
});
