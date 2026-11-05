// Starting points for partners' emails to founders (Deals → Email founders). EDIT THE
// WORDING HERE. Each email is edited before it goes; {{first_name}} and {{company}} are
// filled in per deal, and PASTE-… bits must be replaced before it can be sent.
// "Insert next pitch session" replaces PASTE-SESSION-DETAILS with the session's date, time,
// place and Luma link from Angels → Events.

export const FOUNDER_EMAIL_STARTERS: { id: string; name: string; subject: string; body: string }[] = [
  {
    id: "pitch-session",
    name: "Pitch session invitation",
    subject: "Pitching to the DXV angel community: {{company}}",
    body: [
      "Hi {{first_name}},",
      "",
      "Thank you for your time with the DXV team so far. We'd like to invite {{company}} to pitch to DXV's angel community at our next pitch session:",
      "",
      "PASTE-SESSION-DETAILS",
      "",
      "You'll have about 10 minutes to pitch, followed by questions from members. Please reply to confirm who will be pitching, and send us your latest deck by the end of the week before.",
      "",
      "Best wishes,",
      "The DXV team",
    ].join("\n"),
  },
  {
    id: "update",
    name: "General update",
    subject: "An update from DXV: {{company}}",
    body: ["Hi {{first_name}},", "", "PASTE-YOUR-MESSAGE", "", "Best wishes,", "The DXV team"].join("\n"),
  },
];
