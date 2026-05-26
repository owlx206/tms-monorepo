# Tutor Management System

This context manages teachers, students, classes, learning sessions, attendance, finance records, Discord integration, and Codeforces gym tracking for a tutoring operation.

## Language

### Core Teaching

**Teacher**:
An account holder who manages classes, students, sessions, attendance, finance records, Discord setup, and Codeforces gym tracking.
_Avoid_: User, admin user, account

**Student**:
A learner managed by a teacher.
_Avoid_: Enrollment, member

**Class**:
A teaching group owned by a teacher. A class has schedules, sessions, enrollments, optional Discord binding, and optional assigned gyms.
_Avoid_: Course, classroom when referring to the teaching group

**ClassSchedule**:
A recurring time pattern for a class.
_Avoid_: Session, timetable row

**Session**:
A single scheduled occurrence of a class.
_Avoid_: Class, schedule

**Attendance**:
A student's attendance record for one session.
_Avoid_: Voice attendance, attendance sync

**Enrollment**:
The relationship between a student and a class over a period of time. A student may have at most one active enrollment at a time for a teacher.
_Avoid_: Student status, membership

### Finance

**FeeRecord**:
A charge generated or adjusted for a student's session attendance.
_Avoid_: Invoice, payment

**Transaction**:
A money movement recorded against a student balance.
_Avoid_: Fee, payment when referring to the stored financial event

### Discord

**DiscordBotCredential**:
The system credential used by the Discord bot and OAuth flows.
_Avoid_: Discord config, bot setting

**TeacherDiscordIdentity**:
The Discord user identity linked to a teacher.
_Avoid_: Teacher verification, Discord account

**StudentDiscordCredential**:
The Discord identity and OAuth token linked to a student.
_Avoid_: Student authorization, Discord member

**DiscordGuild**:
A Discord server visible to the system.
_Avoid_: Server when precision is needed

**DiscordChannel**:
A Discord channel within a Discord guild.
_Avoid_: Room

**ClassDiscordBinding**:
The assignment of a Discord guild and selected channels to a class.
_Avoid_: Class Discord setup, guild binding

### Codeforces

**CodeforcesCredential**:
The Codeforces credential linked to a teacher for syncing private or owned gyms.
_Avoid_: Codeforces config, API setting

**Gym**:
A Codeforces gym known to the system, optionally assigned to a class.
_Avoid_: Topic

**GymProblem**:
A problem within a gym.
_Avoid_: Topic problem

**GymStanding**:
A gym's standing, stored as per-student/per-problem rows and displayed as a table.
_Avoid_: Topic standing, standing override

## Flagged Ambiguities

**Flow names are not object names**:
Names such as `class-session-attendance`, `student-enrollment-transfer`, `voice-attendance-finance`, `discord-message-delivery`, `teacher-discord-verification`, `student-discord-authorization`, `codeforces-gym-sync`, and `teacher-account-administration` describe flows or use cases. Do not use them as domain objects or state diagram subjects.

**State diagrams must name one object lifecycle**:
A state diagram must be about one domain object, such as `Session`, `Enrollment`, `Attendance`, `StudentDiscordCredential`, `ClassDiscordBinding`, `Gym`, or `GymStanding`.

**Diagrams explain project concepts, not implementation trivia**:
Diagram labels should use domain objects and project-facing modules. Avoid infrastructure details unless they are the subject of the diagram.
_Avoid_: Singleton client, low-level helper, raw implementation class names

## Module Boundaries

The backend is a modular monolith. Frontend requests enter through `/api/...`; backend modules communicate in-process, not through internal HTTP.

**Account**:
Owns account-facing identity concepts and use cases, including `TeacherAccount`, `AdminAccount`, `TeacherCodeforcesCredential`, `TeacherDiscordIdentity`, `Register`, `Login`, `Me`, `UpdateMyProfile`, and `ChangePassword`.

**System**:
Owns administration use cases, including teacher account administration and Discord bot configuration. It may create or reset accounts through account contracts, but it does not own account credentials.

**Student**:
Owns `Student`, `Enrollment`, and `StudentDiscordCredential`.

**Security**:
Infrastructure, not a business module. Owns JWT, password hashing, auth middleware, current principal, and `requireAdmin` / `requireTeacher` enforcement.

**Dependency rules**:
- Do not import another module's application use cases directly.
- Do not import another module's presentation routes, controllers, or middlewares directly.
- Cross-module imports may use contracts and agreed public `persistence/typeorm` readers or writers.
- Prefer a module's public contracts or public persistence adapter over deep imports into its application or presentation code.
- Do not model an admin as a teacher role. `AdminAccount` and `TeacherAccount` are separate account entities; authentication returns a principal kind such as `admin` or `teacher`.
- HTTP is an external boundary from client to backend only. Backend modules do not call each other over HTTP inside the monolith.

## Example Dialogue

Developer: "Should the state diagram be `class-session-attendance`?"

Domain expert: "No. That is a flow name. If you are showing session states, call it `session-lifecycle`. If you are showing attendance states, call it `attendance-lifecycle`."

Developer: "Is student Discord authorization a domain object?"

Domain expert: "No. The object is `StudentDiscordCredential`. Authorization is the flow that creates or refreshes that credential."

Developer: "Is Codeforces topic still a term?"

Domain expert: "No. Use `Gym`, `GymProblem`, and `GymStanding`."

Developer: "Should the diagram mention that the Codeforces client is a singleton?"

Domain expert: "No. That is implementation trivia. The diagram should explain how `Gym`, `GymProblem`, and `GymStanding` are synced for the project."
