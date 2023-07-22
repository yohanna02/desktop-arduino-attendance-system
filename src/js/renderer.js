window.api.msg();

document.querySelector("#add-class").addEventListener("click", async (e) => {
    const textClass = document.querySelector("#class-text").value.trim();

    if (textClass == "") {
        alert("Empty class name");
        return;
    }

    window.api.addClass(textClass);
});

document.querySelector("#fetch-classes").addEventListener("click", () => {
    window.api.fetchClass();
});

document.querySelector("#table-body").addEventListener("click", (e) => {
    const classId = e.target.dataset.classid;
    if (e.target.tagName === "BUTTON" && e.target.dataset.type === "view students") {
        window.api.viewStudents(classId);
    }
    else if (e.target.tagName === "BUTTON" && e.target.dataset.type === "make attendance") {
        window.api.makeAttendance(classId);
    }
    else if (e.target.tagName === "BUTTON" && e.target.dataset.type === "close attendance") {
        window.api.closeAttendance(classId);
    }
});