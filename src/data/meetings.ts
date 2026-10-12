// Dialogue for the office Meeting task (docs/03: "choose dialogue to keep the boss happy; rank 3+"). Decided
// 2026-10-11: Claude writes it in the dry office tone and the user reviews it afterwards. Each question has three
// replies: one the boss likes, one that passes, one that lands badly. `mood` is what the reply does to the boss's
// mood (0–100); `reaction` is the boss's answer, shown for a moment.

export interface MeetingReply {
  text: string;
  mood: number;
  reaction: string;
}

export interface MeetingQuestion {
  boss: string;
  replies: readonly [MeetingReply, MeetingReply, MeetingReply];
}

export const MEETING_BOSS = 'MR. PELL';

export const MEETING_QUESTIONS: readonly MeetingQuestion[] = [
  {
    boss: 'THE QUARTERLY NUMBERS ARE DOWN. THOUGHTS?',
    replies: [
      { text: 'I FLAGGED THREE COSTS WE CAN CUT.', mood: 20, reaction: 'FINALLY, SOMEONE READ IT.' },
      { text: 'THE MARKET IS SOFT ALL OVER.', mood: 4, reaction: 'SO I HEAR. FROM EVERYONE.' },
      { text: 'DOWN IS JUST UP, WAITING.', mood: -16, reaction: 'PUT THAT ON A MUG. NOT HERE.' },
    ],
  },
  {
    boss: 'WHO TOOK THE LAST COFFEE AND LEFT THE POT EMPTY?',
    replies: [
      { text: 'I MADE A FRESH POT ON THE WAY IN.', mood: 18, reaction: 'THE HERO WE NEEDED.' },
      { text: 'I ONLY DRINK TEA, SIR.', mood: 3, reaction: 'NOTED. SUSPICIOUSLY.' },
      { text: 'WHOEVER HAD THE LAST MEETING.', mood: -14, reaction: 'THAT WAS ME.' },
    ],
  },
  {
    boss: 'CAN THE REPORT BE ON MY DESK BY FRIDAY?',
    replies: [
      { text: 'THURSDAY. WITH A SUMMARY ON TOP.', mood: 20, reaction: 'A SUMMARY. I COULD WEEP.' },
      { text: 'FRIDAY SHOULD BE FINE.', mood: 6, reaction: 'SHOULD. HM.' },
      { text: 'WHICH REPORT?', mood: -18, reaction: 'THE ONE FROM MONDAY.' },
    ],
  },
  {
    boss: 'HEAD OFFICE WANTS MORE SYNERGY. WHAT DOES THAT MEAN?',
    replies: [
      { text: 'FEWER MEETINGS ABOUT MEETINGS.', mood: 16, reaction: "DON'T TELL HEAD OFFICE." },
      { text: 'SHARED CALENDARS, PROBABLY.', mood: 5, reaction: 'PROBABLY. YES.' },
      { text: "NOBODY KNOWS. THAT'S THE POINT.", mood: -12, reaction: 'SAY THAT QUIETER.' },
    ],
  },
  {
    boss: 'THE PRINTER IS JAMMED AGAIN. IDEAS?',
    replies: [
      { text: 'I CLEARED IT AND ORDERED PAPER.', mood: 18, reaction: 'YOU ARE WASTED ON FILING.' },
      { text: 'I CAN CALL FACILITIES.', mood: 5, reaction: 'THEY CLOSE AT NOON.' },
      { text: 'HIT IT. IT WORKS FOR ME.', mood: -15, reaction: 'THAT IS WHY IT IS JAMMED.' },
    ],
  },
  {
    boss: 'WE ARE OVER BUDGET ON THE PELLRIDGE ACCOUNT.',
    replies: [
      { text: 'I CAN MOVE TWO LINES TO NEXT YEAR.', mood: 20, reaction: 'CREATIVE. AND LEGAL?' },
      { text: 'I WILL LOOK INTO IT TODAY.', mood: 6, reaction: 'LOOK QUICKLY.' },
      { text: 'BUDGETS ARE MORE OF A FEELING.', mood: -18, reaction: 'MINE IS DREAD.' },
    ],
  },
  {
    boss: 'THE NEW HIRE KEEPS REPLYING ALL. HANDLE IT?',
    replies: [
      { text: 'I WILL HAVE A QUIET WORD.', mood: 16, reaction: 'QUIET. GOOD. LIKE EMAIL.' },
      { text: 'I CAN SEND A MEMO TO EVERYONE.', mood: 2, reaction: 'TO EVERYONE. ALL OF THEM.' },
      { text: 'REPLY ALL AND TELL THEM TO STOP.', mood: -16, reaction: 'DO NOT DO THAT.' },
    ],
  },
  {
    boss: 'ANY QUESTIONS BEFORE WE WRAP UP?',
    replies: [
      { text: 'NO. CLEAR ACTIONS, THANK YOU.', mood: 18, reaction: 'MY FAVOURITE ANSWER.' },
      { text: 'JUST ONE, ABOUT THE TIMELINE.', mood: 3, reaction: 'EMAIL ME. BRIEFLY.' },
      { text: 'WHY ARE WE HERE, REALLY?', mood: -16, reaction: 'FOR THE MINUTES.' },
    ],
  },
  {
    boss: 'SOMEONE LEFT FISH IN THE BREAK ROOM MICROWAVE.',
    replies: [
      { text: 'I WILL PUT UP A POLITE SIGN.', mood: 16, reaction: 'POLITE. BUT FIRM.' },
      { text: "IT WASN'T ME, FOR THE RECORD.", mood: 2, reaction: 'THE RECORD IS NOTED.' },
      { text: 'IT WAS DELICIOUS, THOUGH.', mood: -16, reaction: 'SEE ME AFTER.' },
    ],
  },
];

/** What the boss says when nobody answers in time. */
export const MEETING_SILENCE = 'I WILL TAKE THAT AS A NO.';
