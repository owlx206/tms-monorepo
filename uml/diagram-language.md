# UML Diagram Language

Diagram labels should describe what a project participant means, not copy the
TypeScript symbol name. Source class names are useful for navigation; UML labels
are for explaining the system.

## Source To Diagram Labels

| Source symbol or group | Meaning in this project | Diagram label |
| --- | --- | --- |
| `AuthController` | HTTP boundary for login and Discord OAuth callbacks | Auth API |
| `AdminController` | HTTP boundary for systeacher account and bot credential actions | Admin API |
| `StudentController` | HTTP boundary for student records, enrollment changes, and student messages | Student API |
| `ClassController`, `ClassScheduleController`, `SessionController`, `AttendanceController` | HTTP boundaries for class, session, and attendance actions | Class API, Session API, Attendance API |
| `ClassDiscordController` | HTTP boundary for bot invite, install callback, guild binding, and class channel posts | Class Discord API |
| `ClassGymController`, `ClassGymStandingReportController` | HTTP boundary for assigning gyms and reading standings | Class Gym API, Gym standing API |
| `Login`, `Register`, `UpdateTeacher`, `ConfigureDiscordBot` | Identity actions, not domain objects | Login, Register teacher, Update teacher, Configure Discord bot |
| `AuthorizeStudentDiscord`, `VerifyTeacherDiscord` | OAuth flows that create or update Discord identities | Student Discord authorization, Teacher Discord verification |
| `CreateStudent`, `TransferStudent`, `WithdrawStudent`, `ReinstateStudent` | Student and enrollment commands | Create student, Transfer student, Withdraw student, Reinstate student |
| `AssignGym`, `UnassignGym`, `GetGymStanding`, `ListAvailableGyms` | Gym catalog, class assignment, and standing read actions | Assign gym, Unassign gym, Read gym standing, List available gyms |
| `AssignDiscordGuild`, `UnassignDiscordGuild`, `GetDiscordBotInviteLink`, `ListDiscordGuilds`, `ListDiscordChannels` | Discord guild/channel binding actions | Assign Discord guild, Unassign Discord guild, Get bot install link, List Discord guilds, List Discord channels |
| `TypeOrm*Reader`, `TypeOrm*Writer`, `*Store`, `*CommandHandlers` | Persistence adapters behind module reader/writer functions | Storage or the specific table/object being stored |
| `TypeOrmStudentDiscordMembershipService`, `StudentDiscordMembershipNotifier` | Adds a linked student Discord identity to the current class guild after enrollment changes | Student guild membership |
| `CodeforcesWorker`, `syncCodeforcesGymsOnce` | Scheduled sync that refreshes gym catalog, problems, and standings | Codeforces gym sync |
| `CodeforcesGym`, `CodeforcesClient` | Codeforces API access for contest list and gym standings | Codeforces API |
| `ClassroomDiscordWorker`, `syncVoiceAttendanceForOpenSessionsOnce` | Scheduled sync that turns Discord voice presence into attendance | Voice attendance sync |
| `DiscordOAuth`, `DiscordGuild`, `DiscordMember`, `DiscordMessenger`, `DiscordVoice`, `DiscordRecipientResolver` | Discord API capabilities | Discord OAuth, Discord guild API, Discord member API, Discord messaging, Discord voice API, Discord recipient lookup |
| `SysadminDiscordBotCredential` | System bot/OAuth credential | Discord bot credential |
| `TeacherCodeforcesCredential` | Teacher Codeforces sync credential | Codeforces credential |
| `StudentDiscordCredential` | Student Discord identity and token | Student Discord credential |
| `Teacher.discord_*` fields | Teacher's linked Discord user identity | Teacher Discord identity |
| `DiscordUserGuild`, `DiscordGuildChannelCache` | Raw Discord guild/channel rows kept before filtering and selection | Discord guild cache, Discord channel cache |
| `ClassDiscordBinding` | Selected Discord guild and channels for a class | Class Discord binding |
| `Gym`, `GymProblem`, `GymStanding` | Codeforces gym catalog, problem list, and per-student/per-problem standing rows | Gym, Gym problem, Gym standing |

## Rules

- Use flow names only as diagram filenames or diagram titles, not as object names.
- State diagrams must show one object's lifecycle.
- Do not mention singleton clients, TypeORM classes, mappers, or helper names unless
  the diagram is specifically about infrastructure.
