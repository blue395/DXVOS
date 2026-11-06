// The starting email partners send when they open members' pitch-selection voting, after the
// round's opportunities have been presented live (Blue, 2026-11-06). Partners edit it before
// sending. Only {{first_name}} and {{platform_link}} (the sign-in page) are filled in per member.
import { PRE_SELECTION_VOTE_LIMIT } from "@/lib/pipeline";

const when = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(d);

export function angelVotesEmail(round: number, closesAt: Date) {
  return {
    subject: `Round ${round}: voting is now open`,
    body: `Hi {{first_name}},

Thank you for joining us for the Round ${round} investment opportunities. Voting is now open.

Choose up to ${PRE_SELECTION_VOTE_LIMIT} companies you'd like to hear pitch: the ${PRE_SELECTION_VOTE_LIMIT} with the most votes are invited to pitch to the syndicate. A vote is not a commitment to invest, and you can change your votes until voting closes on ${when(closesAt)} (UK time).

[Vote now on DXV OS]({{platform_link}})

Best wishes,
The DXV team`,
  };
}
