ALTER TABLE promotion_credit_topups DROP CONSTRAINT promotion_credit_topups_status_check;
ALTER TABLE promotion_credit_topups ADD CONSTRAINT promotion_credit_topups_status_check
CHECK (status IN ('CREATING','UNKNOWN','PENDING','PAID','CANCELLED','EXPIRED','BLOCKED'));
