ALTER TABLE "library_resources" ADD COLUMN "mime_type" varchar(120) DEFAULT 'application/octet-stream' NOT NULL;
UPDATE "library_resources"
SET "mime_type" = CASE
	WHEN lower("name") LIKE '%.pdf' THEN 'application/pdf'
	WHEN lower("name") LIKE '%.doc' THEN 'application/msword'
	WHEN lower("name") LIKE '%.docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	WHEN lower("name") LIKE '%.xls' THEN 'application/vnd.ms-excel'
	WHEN lower("name") LIKE '%.xlsx' THEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	WHEN lower("name") LIKE '%.ppt' THEN 'application/vnd.ms-powerpoint'
	WHEN lower("name") LIKE '%.pptx' THEN 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
	WHEN lower("name") LIKE '%.txt' THEN 'text/plain'
	WHEN lower("name") LIKE '%.epub' THEN 'application/epub+zip'
	ELSE 'application/octet-stream'
END
WHERE "mime_type" = 'application/octet-stream';