BEGIN;

CREATE TABLE teams(
   
   id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
   name            TEXT NOT NULL UNIQUE,
   hours_per_point NUMERIC(5,2) NOT NULL CHECK (hours_per_point > 0)
);

CREATE TABLE members(

   id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
   team_id      INTEGER NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
   name         TEXT NOT NULL,
   weekly_hours NUMERIC(4,1) NOT NULL CHECK(weekly_hours BETWEEN 0 AND 168)
);

CREATE TABLE skills(

   id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
   name TEXT NOT NULL UNIQUE
);

CREATE TABLE member_skills(

   member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
   skill_id  INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
   PRIMARY KEY(member_id , skill_id)
);

CREATE TABLE member_leaves(

   id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
   member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
   start_date DATE NOT NULL,
   end_date   DATE NOT NULL,
   CHECK(end_date>=start_date)
);

CREATE TABLE tasks(

   id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
   team_id           INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
   title             TEXT NOT NULL,
   description       TEXT,
   priority          SMALLINT NOT NULL CHECK(priority BETWEEN 1 AND 4),
   deadline          DATE,
   story_points      INTEGER CHECK(story_points>0),
   required_skill_id INTEGER REFERENCES skills(id) ON DELETE RESTRICT
);
 
CREATE TABLE task_dependencies(

   task_id            INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
   depends_on_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
   PRIMARY KEY(task_id,depends_on_task_id),
   CHECK(task_id <> depends_on_task_id)
);

CREATE TABLE sprints(

   id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
   team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
   name TEXT NOT NULL,
   start_date DATE NOT NULL,
   end_date DATE NOT NULL,
   UNIQUE (team_id, name),
   CHECK(end_date >= start_date)
);

CREATE TABLE assignments(
  
   task_id INTEGER PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
   member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
   sprint_id INTEGER NOT NULL REFERENCES sprints(id) ON DELETE CASCADE
);

COMMIT;
   



   