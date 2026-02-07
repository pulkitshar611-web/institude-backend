-- Update Students to Hebrew Names
UPDATE students SET full_name = 'אהרון שרמה', address = 'בלוק ב, 402, גדי עמק', city = 'פונה' WHERE student_id = 'STU-2024-001';
UPDATE students SET full_name = 'אישה קפור', address = '12, קווים אזרחיים', city = 'מומבאי' WHERE student_id = 'STU-2024-002';
UPDATE students SET full_name = 'רוהאן גופטה', address = 'דירה 201, גבהי שמש', city = 'דלהי' WHERE student_id = 'STU-2024-003';

-- Update Parents to Hebrew Names
UPDATE parents SET full_name = 'ראג׳ש שרמה' WHERE full_name = 'Rajesh Sharma';
UPDATE parents SET full_name = 'פריה שרמה' WHERE full_name = 'Priya Sharma';
UPDATE parents SET full_name = 'עמית קפור' WHERE full_name = 'Amit Kapoor';
UPDATE parents SET full_name = 'סנאה קפור' WHERE full_name = 'Sneha Kapoor';
UPDATE parents SET full_name = 'ויקראם גופטה' WHERE full_name = 'Vikram Gupta';
UPDATE parents SET full_name = 'אנג׳לי גופטה' WHERE full_name = 'Anjali Gupta';

-- Update Donors to Hebrew Names
UPDATE donors SET name = 'ד״ר ארווינד פאטל' WHERE donor_id = 'DNR-001';
UPDATE donors SET name = 'גב׳ קיוויטה רדי' WHERE donor_id = 'DNR-002';
