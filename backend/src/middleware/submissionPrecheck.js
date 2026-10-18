const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Assignment, Submission } = require('../models');
const { requireStudentAccess } = require('../services/courseAccess');

// Runs before the upload so a rejected submission never writes a file to disk.
module.exports = asyncHandler(async (req, _res, next) => {
  if (req.user.role !== 'student') throw new ApiError(403, 'Only students can submit assignments');
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) throw new ApiError(404, 'Assignment not found');
  await requireStudentAccess(req.user, assignment.course);

  const existing = await Submission.findOne({ assignment: assignment._id, student: req.user._id });
  const late = new Date() > assignment.dueAt;
  if (late && !assignment.allowLate) throw new ApiError(403, 'The deadline has passed and late submissions are not accepted');
  if (existing && existing.status === 'graded') throw new ApiError(409, 'This submission has already been graded');
  if (existing && late) throw new ApiError(403, 'The deadline has passed, so your submission can no longer be changed');

  req.assignment = assignment;
  req.existingSubmission = existing;
  req.isLate = late;
  next();
});
