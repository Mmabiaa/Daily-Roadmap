export type Category = 'class' | 'study' | 'project' | 'body' | 'eat' | 'people' | 'rest' | 'chores' | 'sleep'
export type Block = { time: string; title: string; category: Category; note?: string; essential?: boolean; id?: string }
export const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as const
export type Day = typeof days[number]

export const focus: Record<Day,string> = {
 Mon:'Long class day. Protect the 1:15 to 3:30 PM gap.',
 Tue:'Six classes in a row from 6:30 AM. Eat early, pack water and a snack.',
 Wed:'Quiet morning for deep study. Lab, then classes until 7 PM.',
 Thu:'Study after the early class. Strength B tonight.',
 Fri:'Light classes. Finish the week’s assignments before the weekend.',
 Sat:'Train, study, reset the room, then a guilt-free fun night.',
 Sun:'Reset day. Review the week, set up the system, call family.'
}

const B=(time:string,title:string,category:Category,note?:string,essential?:boolean):Block=>({time,title,category,note,essential})

export const schedule: Record<Day,Block[]> = {
 Mon:[B('05:30','Wake · water · make bed','body',undefined,true),B('05:40','Shower · dress · fragrance','body'),B('06:10','Light breakfast','eat'),B('06:30','CE 481 Data Communication','class','Online · Dr A. K. Kwansah Ansah',true),B('08:30','Proper breakfast + Duolingo','eat','Check the class group once, then close it',true),B('09:00','Study: recall this morning’s Data Comm','study',undefined,true),B('10:10','Walk to SR 5B','chores'),B('10:30','CE 475 Computer Networks','class','SR 5B · Dr A. K. Kwansah Ansah',true),B('12:30','Lunch','eat'),B('13:15','Rest: 20-min nap or quiet','rest'),B('13:45','Study: assignments','study'),B('15:30','Snack · pack · walk to SR 5A','chores'),B('16:00','CE 471 Industrial Electronics','class','SR 5A · I. K. Prah',true),B('18:00','CE 463 Digital Signals & Image Processing','class','SR 7A · Dr E. O. Gyamfi',true),B('19:00','Walk home · dinner','eat'),B('19:45','Shower · fresh clothes','body'),B('20:10','Side project','project','Minimum: 1 commit',true),B('21:00','Duolingo · pack bag · lay out clothes','chores','Check the class group once',true),B('21:30','Wind-down: phone parked · read · 3-line journal','rest'),B('22:00','Lights out','sleep','On time',true)],
 Tue:[B('05:30','Wake · water · make bed','body',undefined,true),B('05:40','Shower · dress · fragrance','body'),B('06:10','Light breakfast','eat'),B('06:30','CE 475 Computer Networks','class','Online · Dr A. K. Kwansah Ansah',true),B('08:30','CE 467 Robotics','class','SR 5B · Dr E. M. Martey',true),B('10:30','CE 471 Industrial Electronics','class','Online · I. K. Prah',true),B('12:30','Lunch','eat'),B('13:15','Rest: 20-min nap or quiet','rest'),B('13:35','Study: assignments','study',undefined,true),B('14:30','Side project','project','30 minutes, 1 commit',true),B('15:00','CE 451 Project Work','class','Online · Dr T. Kwantwi',true),B('17:00','Call a loved one · snack','people','Check the class group once'),B('17:45','Walk to SR 7A','chores'),B('18:00','CE 463 Digital Signals & Image Processing','class','SR 7A · Dr E. O. Gyamfi',true),B('19:00','Walk home · dinner','eat'),B('19:45','Digest · set up for workout','chores'),B('20:00','Strength A','body','45 minutes'),B('20:45','Shower · fresh clothes','body'),B('21:10','Duolingo · pack bag · lay out clothes','chores',undefined,true),B('21:30','Wind-down: phone parked · read · 3-line journal','rest'),B('22:00','Lights out','sleep','On time',true)],
 Wed:[B('05:30','Wake · water · stretch','body',undefined,true),B('06:00','Morning run','body','30 to 40 minutes, easy pace'),B('06:45','Shower · dress · fragrance','body'),B('07:10','Breakfast + Duolingo','eat',undefined,true),B('07:30','Deep study 1: hardest course','study',undefined,true),B('09:00','Break · walk · water','rest'),B('09:15','Deep study 2: assignments','study'),B('10:45','Break','rest'),B('11:00','Side project','project','Minimum: 1 commit',true),B('12:00','Lunch','eat'),B('12:45','Walk to Computer Lab','chores'),B('13:00','CE 481 Data Communication','class','Computer Lab · Dr A. K. Kwansah Ansah',true),B('15:00','CE 459 Operational Research','class','Online · E. Asante',true),B('17:00','CE 467 Robotics','class','SR 5B · Dr E. M. Martey',true),B('19:00','Walk home · dinner','eat'),B('19:45','Shower · fresh clothes','body'),B('20:10','Open time: hobby · friends · read','rest','Phone stays in its spot'),B('21:00','Duolingo · pack bag · lay out clothes','chores',undefined,true),B('21:30','Wind-down: phone parked · read · 3-line journal','rest'),B('22:00','Lights out','sleep','On time',true)],
 Thu:[B('05:30','Wake · water · make bed','body',undefined,true),B('05:40','Shower · dress · fragrance','body'),B('06:10','Light breakfast','eat'),B('06:30','CE 463 Digital Signals & Image Processing','class','Online · Dr E. O. Gyamfi',true),B('08:30','Proper breakfast + Duolingo','eat',undefined,true),B('09:00','Study: DSIP recall + hardest course','study',undefined,true),B('10:30','Break','rest'),B('10:45','Study: assignments','study'),B('12:30','Lunch','eat'),B('13:15','Rest: 20-min nap or quiet','rest'),B('13:35','Side project','project','Minimum: 1 commit',true),B('14:30','Pack · walk to SR 1B','chores'),B('15:00','CE 459 Operational Research','class','SR 1B · E. Asante',true),B('17:00','Call a loved one · snack','people'),B('17:45','Walk to SR 3','chores'),B('18:00','CE 475 Computer Networks','class','SR 3 · Dr A. K. Kwansah Ansah',true),B('19:00','Walk home · dinner','eat'),B('19:45','Digest · set up for workout','chores'),B('20:00','Strength B','body','45 minutes'),B('20:45','Shower · fresh clothes','body'),B('21:10','Duolingo · pack bag · lay out clothes','chores',undefined,true),B('21:30','Wind-down: phone parked · read · 3-line journal','rest'),B('22:00','Lights out','sleep','On time',true)],
 Fri:[B('05:30','Wake · water · make bed','body',undefined,true),B('05:40','Shower · dress · fragrance','body'),B('06:00','Study: weekly recap + Robotics prep','study',undefined,true),B('07:30','Breakfast + Duolingo','eat',undefined,true),B('08:00','Study: assignments','study'),B('09:15','Set up for class','chores'),B('09:30','CE 467 Robotics','class','Online · Dr E. M. Martey',true),B('11:30','CE 475 Computer Networks','class','SR 3 · Dr A. K. Kwansah Ansah',true),B('12:30','Lunch','eat'),B('13:15','Rest: 20-min nap or quiet','rest'),B('13:35','Study: finish the week’s assignments','study',undefined,true),B('15:15','Side project','project','30 minutes, 1 commit',true),B('15:45','Weekly wrap-up: tick off deadlines · list next week','chores'),B('16:15','Easy sport or cardio','body','Keep it light'),B('17:15','Shower · fresh clothes','body'),B('17:45','Free time: friends · rest','rest'),B('19:00','Dinner','eat'),B('19:45','Free evening: hang out · rest','rest'),B('21:30','Wind-down: phone parked · read · 3-line journal','rest'),B('22:30','Lights out','sleep','On time',true)],
 Sat:[B('06:30','Wake · water · make bed','body',undefined,true),B('06:45','Long run or sport','body'),B('07:45','Shower · dress · fragrance','body'),B('08:15','Breakfast + Duolingo','eat',undefined,true),B('09:00','Study 1: weakest course','study',undefined,true),B('10:30','Break','rest'),B('10:45','Study 2: assignments','study'),B('12:15','Side project','project','Minimum: 1 commit',true),B('13:00','Lunch + rest','eat'),B('14:00','Laundry · room reset · grooming','chores'),B('15:30','Free time: friends · outdoors · hobby','rest'),B('18:30','Dinner','eat'),B('19:15','Fun night: a full movie or a game, guilt-free','rest'),B('21:45','Wind-down: phone parked · read · 3-line journal','rest'),B('22:30','Lights out','sleep','On time',true)],
 Sun:[B('06:30','Wake · water · make bed','body',undefined,true),B('06:45','Shower · dress · fragrance','body'),B('07:15','Easy walk or stretch','body'),B('07:45','Breakfast + Duolingo','eat',undefined,true),B('08:30','Weekly review: deadlines · assignments · top 3 for the week','chores','Write each due date down. Check the class group.',true),B('09:30','Study 1: recap the week’s hardest course','study',undefined,true),B('10:30','Break','rest'),B('10:45','Study 2: get ahead on one assignment','study'),B('11:45','Side project','project','Minimum: 1 commit',true),B('12:45','Lunch','eat'),B('13:30','Laundry · room reset · food prep','chores'),B('15:00','Rest or free time','rest'),B('17:00','Call family or a loved one','people'),B('17:45','Set up the week: bag · clothes · charger across the room · alarm 5:30','chores'),B('18:30','Dinner','eat'),B('19:15','Open evening: read · hobby · music','rest'),B('21:15','Wind-down: phone parked · read · 3-line journal','rest'),B('22:00','Lights out','sleep','On time',true)]
}

export const categoryMeta: Record<Category,{label:string; color:string}> = {
 class:{label:'Class',color:'--class'},
 study:{label:'Study',color:'--study'},
 project:{label:'Side project',color:'--project'},
 body:{label:'Body',color:'--body'},
 eat:{label:'Eat',color:'--eat'},
 people:{label:'People',color:'--people'},
 rest:{label:'Rest',color:'--rest'},
 chores:{label:'Chores',color:'--chores'},
 sleep:{label:'Sleep',color:'--sleep'}
}

export const phoneRules = [
 'Charger across the room, never at the bed. Alarm set for 5:30.',
 'Class and study blocks: phone in the bag, Do Not Disturb on, favourites allowed through.',
 'Class WhatsApp group: check only at 8:30 AM, 12:30 PM, 5:00 PM and 9:00 PM, then close it.',
 'Keep only WhatsApp, Duolingo and GitHub on the home screen. Video and social apps are logged out.',
 '9:30 PM: phone goes to its parking spot until the next morning routine is done.'
]

export const studyRules = [
 '50 minutes on one task, 10 minutes off. Phone away.',
 'Last 5 minutes: close the notes and write what you remember.',
 'Deep blocks go to the hardest course first, while the brain is fresh.'
]