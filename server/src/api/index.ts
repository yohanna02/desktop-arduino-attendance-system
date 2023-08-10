import { Router } from "express";
import classModel from "../model/classModel";
import fingerModel from "../model/fingerModel";
import studentModel from "../model/studentModel";

const router = Router();

router.get("/class", async (req, res) => {
    const select = req.query.select as string;
    const classes = await classModel.find({}).select(select);

    res.json({
        size: classes.length,
        classes
    });
});

router.get("/verify-id", async (req, res) => {
    const id = req.query.id as string;

    const found = await fingerModel.findOne({fingerprintId: id});

    if (found) {
        res.json({data: "found"});
    }
    else {
        res.json({data: "not-found"});
    }
});

router.post("/take-attendance", async (req, res) => {
    const { classId, fingerprintId } = req.body as {classId: string, fingerprintId: string};

    const finger = await fingerModel.findOne({ fingerprintId });
    if (!finger) {
        res.status(404).json({msg: "Fingerprint not found"});
        return;
    }
    const _class = await classModel.findOne({_id: classId});
    if (!_class) {
        res.status(404).json({msg: "Attendance not open"});
        return;
    }

    const student = await studentModel.findOne({fingerprintId});
    
    // const openedAttendance = _class.attendance.find(attend => attend.open === true);
    let found = false;
    let i = 0;
    for (i = 0; i < _class.attendance.length; i++) {
        if (_class.attendance[i].open) {
            found = true;
            break;
        }
    }
    
    if (found && student && !_class.attendance[i].studentIds.includes(student._id)) {
        _class.attendance[i].studentIds.push(student._id);
        await _class.save();
        res.json({msg: "DONE"});
    }
    else {
        res.status(400).json({msg: "Error"}); 
    }

});

export default router;