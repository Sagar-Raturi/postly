"""
The prose behind `seed_sagar`, kept out of the command so the command itself
stays readable.

Bodies are stored HTML, the same shape the TipTap editor produces, because
that is what the public blog and the dashboard's inline expander render. The
set is chosen to exercise the typography rather than to fill space: three
posts carry an <h2>, two a <blockquote>, three a <ul>, and the lengths run
from about 200 words to about 900 so read-time estimates and excerpt
truncation are tested against real variation rather than uniform filler.

Dates are timezone-aware UTC. `published_at` is passed explicitly at
creation, so Post.save() leaves it alone instead of stamping "now".
"""

from datetime import datetime, timezone as dt_timezone

from blog.models import Post


def _published(year: int, month: int, day: int) -> datetime:
    """09:00 UTC on the given day — a plausible hour to have hit publish."""
    return datetime(year, month, day, 9, 0, tzinfo=dt_timezone.utc)


POSTS = [
    {
        "title": "Why I Started Writing Again",
        "status": Post.Status.PUBLISHED,
        "published_at": _published(2026, 1, 12),
        "content": (
            "<p>I kept a blog for three years at university and then stopped "
            "the way most people stop: not with a decision but with a gap. A "
            "week became a month, the month became a redesign I never "
            "finished, and the redesign became a folder on an old laptop I "
            "have not opened since.</p>"
            "<p>What brought me back was not inspiration. It was noticing "
            "that I had been having the same argument about state management "
            "for four years and had never once written any of it down. Every "
            "time the subject came up I rebuilt the case from scratch, badly, "
            "and had forgotten it again by Friday. That is an expensive way "
            "to hold an opinion.</p>"
            "<p>Writing is the cheapest tool I know for finding out whether I "
            "actually understand something. A thought can stay comfortably "
            "vague in your head for years. On the page it has to commit — "
            "this, not that, for these reasons — and the moment it commits "
            "you can see the hole in it.</p>"
            "<p>So this time the bar is somewhere I can reach. No schedule I "
            "will come to resent, no subject I have to stay on. If something "
            "takes more than an evening to explain, that is a sign I do not "
            "understand it yet, and the honest move is to publish the partial "
            "version and come back to it.</p>"
            "<p>The archive is the point. Not the audience, not the traffic — "
            "the archive. In a year I want to be able to search my own "
            "writing and find out what I thought about something before the "
            "experience that changed my mind.</p>"
        ),
    },
    {
        "title": "Notes on Learning Django",
        "status": Post.Status.PUBLISHED,
        "published_at": _published(2026, 1, 28),
        "content": (
            "<p>I came to Django from a few years of writing Express services "
            "by hand, and the first week was mostly indignation. Why does the "
            "framework have opinions about my directory layout? Why is there "
            "an admin site I did not ask for? Why does adding a column "
            "involve a file that gets checked into version control?</p>"
            "<p>The indignation lasted until the first time I had to change "
            "something. Then it turned, fairly abruptly, into relief.</p>"
            "<h2>The ORM is not the interesting part</h2>"
            "<p>Everyone writes about the ORM, and it is good, but it is not "
            "what makes the framework worth learning. Any decent query "
            "builder will hand you objects instead of rows. What Django gives "
            "you is a set of defaults that were argued over by people who had "
            "already shipped the thing you are about to ship, and who lost "
            "data doing it.</p>"
            "<p>Migrations are the clearest example. In my Express services "
            "the schema lived in whatever SQL file the last person had run, "
            "plus a shared understanding that staging was probably a version "
            "behind. Django makes the schema a sequence of reviewable, "
            "reversible files, and then refuses to let you forget one. The "
            "first time I ran <code>makemigrations</code> and it told me about "
            "a field I had changed and not thought about, I understood what I "
            "had been paying for with all that flexibility.</p>"
            "<p>The same turned out to be true of every part that had felt "
            "like overreach:</p>"
            "<ul>"
            "<li><strong>The admin.</strong> I dismissed it as a toy for a "
            "month. It is not a toy; it is the difference between debugging "
            "production data in a database client at midnight and clicking "
            "three links.</li>"
            "<li><strong>Forms and serializers.</strong> Validation belongs "
            "somewhere consistent, and every project that invents its own "
            "place for it has invented three places for it by the second "
            "year.</li>"
            "<li><strong>The settings module.</strong> Ugly, global, and "
            "completely unambiguous about where configuration lives.</li>"
            "<li><strong>The test client.</strong> Being able to exercise a "
            "whole request cycle without a running server changed how often I "
            "write tests, which is the only metric that matters.</li>"
            "</ul>"
            "<p>None of these are clever. That is the point. Each one is a "
            "decision somebody made so that I would not have to make it "
            "badly at eleven at night, and the cumulative effect of a "
            "hundred of them is that a Django project written by a stranger "
            "is a project I can read. I have inherited three now. In each "
            "case I knew where the models were before I opened the "
            "directory, and I cannot say that about a single Express service "
            "I have been handed, including two I wrote myself.</p>"
            "<h2>What actually took time</h2>"
            "<p>The framework took a fortnight. The habits took months. "
            "Specifically: learning to let the queryset do the filtering "
            "instead of pulling rows into Python and looping over them; "
            "learning that <code>select_related</code> is not an optimisation "
            "you add later but a statement about what a view needs; learning "
            "to read the generated SQL when something is slow instead of "
            "guessing at it.</p>"
            "<p>The hardest habit was trusting the framework's boundaries. "
            "Coming from a codebase where I had written every layer myself, "
            "my instinct on hitting friction was to reach under the "
            "abstraction and fix it. About half the time the friction was the "
            "framework telling me my design was wrong, and the half I "
            "overrode anyway is where the bugs are.</p>"
            "<p>There is a failure mode on the other side of that, which I "
            "also hit. For about two months I would not write plain SQL for "
            "anything, on principle, and produced some genuinely baroque "
            "queryset chains to avoid it. A raw query with a comment above it "
            "explaining why is not a defeat. It is often the most honest "
            "thing in the file. The rule I settled on is that the ORM owns "
            "everything a future reader will need to change, and SQL owns the "
            "three reports nobody has touched since the quarter they were "
            "asked for.</p>"
            "<p>The other thing nobody warned me about is how much of "
            "learning a mature framework is learning its history. Half the "
            "confusing advice on the internet is correct for a version four "
            "releases back. I lost a full day to a pattern that had been "
            "idiomatic in 2016 and has been a documented anti-pattern since "
            "2019, and the blog post explaining it was still the top result. "
            "Now I check the release notes before the search results, which "
            "sounds obvious written down and took me an embarrassingly long "
            "time to start doing.</p>"
            "<p>If I were starting again I would spend the first week reading "
            "the source of one app I use — not the docs, the source. Django's "
            "internals are unusually readable, and a morning inside "
            "<code>django/db/models/query.py</code> does more for your mental "
            "model than a week of tutorials. Most of what felt like magic "
            "turned out to be four hundred lines of careful, ordinary Python "
            "that somebody has maintained for fifteen years.</p>"
            "<p>That is the part I did not expect to find valuable. Not the "
            "features — the maintenance. Every default in there is a decision "
            "that survived a decade of people trying to break it.</p>"
        ),
    },
    {
        "title": "The Case for Boring Technology",
        "status": Post.Status.PUBLISHED,
        "published_at": _published(2026, 2, 9),
        "content": (
            "<p>There is a particular kind of engineer who can tell you the "
            "trade-offs of six message queues and has never run any of them "
            "for a year. I have been that engineer. The cure was operating "
            "something I had chosen badly.</p>"
            "<p>The argument for boring technology is usually made in terms "
            "of risk, which undersells it. The real argument is about where "
            "your attention goes. Every unusual choice in a system is a "
            "standing withdrawal from the same account: the hour spent "
            "working out why your exotic database does something strange "
            "under load is an hour not spent on the thing your readers "
            "actually asked for.</p>"
            "<blockquote><p>Choose boring technology, and spend your scarce "
            "novelty budget on the problem that is actually yours.</p>"
            "</blockquote>"
            "<p>What makes something boring is not age. It is the density of "
            "answers around it. Postgres is boring because when it does "
            "something surprising at two in the morning, the surprise has "
            "already happened to ten thousand people and eight of them wrote "
            "it up. That is not a small property. It is most of the value.</p>"
            "<p>None of which means never choosing the new thing. It means "
            "being honest about how many new things a project can carry at "
            "once, and the answer is roughly one. If the new thing is your "
            "product, everything underneath it should be as dull as you can "
            "stand. If you want to play with the unfamiliar datastore, do it "
            "somewhere the failure mode is a bad afternoon rather than a bad "
            "quarter.</p>"
            "<p>The version of this I keep having to relearn is smaller and "
            "more personal: the boring choice is usually the one I already "
            "know how to debug. Not the best tool. The one I could be woken "
            "at three in the morning and still reason about.</p>"
        ),
    },
    {
        "title": "Three Weeks in Spiti Valley",
        "status": Post.Status.PUBLISHED,
        "published_at": _published(2026, 2, 24),
        "content": (
            "<p>The bus from Manali leaves at five in the morning and the "
            "road stops pretending to be a road about two hours later. I had "
            "been told this. Being told this does not prepare you for the "
            "stretch above Gramphu where the surface is river for forty "
            "metres and the driver does not slow down, because slowing down "
            "is how you get stuck.</p>"
            "<p>I went to Spiti because I had spent four months looking at a "
            "screen in a room with one window, and because a friend said the "
            "word altitude in a way that sounded like a dare. I stayed three "
            "weeks. I had packed for nine days.</p>"
            "<h2>The first week is just weather</h2>"
            "<p>Nobody tells you how much of high-altitude travel is simply "
            "waiting. The light is extraordinary and the air is thin and for "
            "the first four days I had a headache that sat behind my eyes and "
            "made every decision feel like an imposition. You do not "
            "acclimatise by being brave about it. You acclimatise by drinking "
            "an unreasonable amount of water and going to bed at eight.</p>"
            "<p>In Kaza I shared a guesthouse kitchen with a Slovenian couple "
            "who had been cycling for eleven months and a man from Chennai "
            "who had come, he said, to not answer his phone. The wifi worked "
            "for about an hour each evening, which turned out to be exactly "
            "the right amount of wifi — long enough to tell people I was "
            "alive, not long enough to check anything.</p>"
            "<p>The valley is brown in a way photographs cannot hold. Not "
            "drab: brown the way a good loaf is brown, with reds and greys "
            "and a kind of violet in the shadows at four in the afternoon. "
            "Then you come around a bend and there is a field of barley, "
            "absurdly green, and a village of whitewashed houses that has "
            "farmed the same terraces for six hundred years.</p>"
            "<p>Food becomes a much bigger part of the day than it is at "
            "home, partly because there is less else to organise a day "
            "around and partly because at that altitude you are hungry in a "
            "way that feels slightly unreasonable. I ate thukpa most "
            "evenings. There was a woman in Tabo who made momos in a kitchen "
            "roughly the size of my bathroom and who refused, over four "
            "separate attempts, to let me pay the price on the board, on the "
            "grounds that I had walked there. I have thought about that more "
            "often than about anything I saw.</p>"
            "<h2>What I was actually doing there</h2>"
            "<p>I told people I was going to think. That was not really true. "
            "What I did was walk, badly, at altitude, and sit on walls, and "
            "have long conversations with strangers about nothing in "
            "particular. The thinking happened anyway, the way it does once "
            "you stop scheduling it.</p>"
            "<p>The monastery at Key sits on its hill like something that "
            "grew there. I climbed up on my second-last morning and sat at "
            "the back of a room while about twenty monks, most of them "
            "younger than my brother, chanted through something I did not "
            "understand for an hour and a half. I am not a religious person "
            "and I do not want to dress this up. But the sound of twenty "
            "people doing the same unhurried thing together, in a building "
            "that has been standing since before my country existed, "
            "rearranged something that four months of good intentions had not "
            "touched.</p>"
            "<p>I should say something about the roads, because everyone "
            "asks and the honest answer is that they are worse than the "
            "photographs and better than the stories. The Kunzum Pass is at "
            "roughly four and a half thousand metres and the last hour up to "
            "it is single-track gravel with a drop on one side and no barrier "
            "on either, and the drivers who do it every week treat it with "
            "the exact amount of respect you would give a familiar staircase. "
            "That is either reassuring or the opposite, depending on the hour "
            "and how much you have slept. What I did not expect was how "
            "quickly the fear becomes boredom. By the second week I was "
            "reading on those roads.</p>"
            "<p>The other thing I did not expect was the silence. Not quiet "
            "— silence, the sort with no floor under it, where you become "
            "aware of the sound of your own circulation. I sat above Dhankar "
            "one afternoon for about an hour and heard, in total, one bird "
            "and one distant engine. I have not been able to reproduce that "
            "anywhere since, and I have started to think a fair amount of "
            "what people go to mountains for is simply the absence of other "
            "people's noise.</p>"
            "<p>Coming down was harder than going up, which everyone says "
            "about mountains and nobody means about the descent. I mean the "
            "week after: Delhi at thirty-eight degrees, four hundred unread "
            "emails, and the particular flatness of being somewhere that is "
            "not extraordinary. It took a fortnight to stop being irritated "
            "by everybody.</p>"
            "<p>What survived is smaller than I expected and more useful. I "
            "sleep earlier. I check my phone less in the first hour of the "
            "day. And when something at work feels urgent I have a reliable "
            "way of testing it now, which is to ask whether it would have "
            "been urgent from a guesthouse kitchen in Kaza with one hour of "
            "wifi. Almost nothing is.</p>"
        ),
    },
    {
        "title": "What My First Failed Side Project Taught Me",
        "status": Post.Status.PUBLISHED,
        "published_at": _published(2026, 3, 15),
        "content": (
            "<p>It was a habit tracker. Of course it was a habit tracker. I "
            "worked on it for seven months and it had authentication, a "
            "billing integration, a dark mode, an onboarding flow, and "
            "eventually four users, three of whom I am related to.</p>"
            "<p>The failure was not technical. The app worked. The failure "
            "was that I spent seven months building for a person I had "
            "invented, and in seven months I never once asked a real one "
            "whether they wanted it. I knew this was the advice. I had read "
            "the advice. I simply preferred writing code to having "
            "conversations, and I dressed that preference up as focus.</p>"
            "<p>What I would do differently is not build less. It is to ship "
            "the ugly version in week two instead of month five. Everything I "
            "eventually learned about why it was not working was available in "
            "the first fortnight, for the price of a worse-looking app and a "
            "slightly embarrassing link sent to eleven people.</p>"
        ),
    },
    {
        "title": "Setting Up a Home Server on a Budget",
        "status": Post.Status.PUBLISHED,
        "published_at": _published(2026, 4, 2),
        "content": (
            "<p>The whole thing cost about eleven thousand rupees, most of "
            "which was the drive. It runs my file backups, a music library, a "
            "read-it-later service, and the occasional job I want to leave "
            "going overnight without leaving my laptop open.</p>"
            "<p>The machine is a second-hand small-form-factor office desktop "
            "— the kind that turns up in bulk when a company refreshes its "
            "fleet. Ex-corporate hardware is the best value in home computing "
            "and almost nobody talks about it, probably because it is beige "
            "and boring and does not benchmark well. It idles at about twelve "
            "watts and has been up for a hundred and forty days.</p>"
            "<p>What I would tell somebody starting today:</p>"
            "<ul>"
            "<li><strong>Buy the drive new, buy everything else used.</strong> "
            "A used drive is a used drive's remaining life, and you have no "
            "way of knowing what that is.</li>"
            "<li><strong>Do not buy a NAS enclosure first.</strong> Start "
            "with one disk and a copy somewhere else. Redundancy is not "
            "backup, and most people who buy the enclosure never get around "
            "to the backup.</li>"
            "<li><strong>Wire it.</strong> One cable solves more problems "
            "than any amount of wifi tuning.</li>"
            "<li><strong>Write down what you did.</strong> You will rebuild "
            "this in eighteen months and you will not remember why that one "
            "service needs that one flag.</li>"
            "</ul>"
            "<p>The part I got wrong for a year was exposure. I had things "
            "reachable from outside because that felt like the point, and I "
            "spent an unreasonable amount of attention on certificates and "
            "reverse proxies and worrying about what I had left open. Then I "
            "put the whole thing behind a private network and stopped "
            "thinking about it entirely. If you are the only user, being on "
            "the internet is a cost, not a feature.</p>"
            "<p>The honest summary is that a home server is not cheaper than "
            "paying for the equivalent services, once you count the evenings. "
            "It is better in a different way: nothing on it gets "
            "discontinued, repriced, or quietly changed while I am asleep.</p>"
        ),
    },
    {
        "title": "A Simple System for Reading More Books",
        "status": Post.Status.PUBLISHED,
        "published_at": _published(2026, 5, 6),
        "content": (
            "<p>I read four books in 2024 and thirty-one in 2025, and the "
            "only thing that changed was that I stopped treating finishing as "
            "compulsory.</p>"
            "<p>The whole system is two rules. Always have the book "
            "physically with me, in a bag, rather than on a shelf where it is "
            "aspirational. And abandon anything that is not working by page "
            "fifty, without guilt and without finishing it later out of some "
            "sense of debt.</p>"
            "<p>The second rule is the one that did the work. Half my reading "
            "years were spent stuck three chapters into something respectable "
            "that I was not enjoying, not reading anything else, and feeling "
            "bad about it. Abandoning a book costs an hour. Being stuck on "
            "one costs a season.</p>"
        ),
    },
    {
        "title": "My Grandmother's Rajma, Written Down at Last",
        "status": Post.Status.PUBLISHED,
        "published_at": _published(2026, 6, 18),
        "content": (
            "<p>My grandmother cooked rajma every Sunday for about fifty "
            "years and never once measured anything. I have been meaning to "
            "write this down since she died, and the difficulty is not the "
            "ingredients. It is that half of what made it hers was timing she "
            "could not have explained if she had wanted to.</p>"
            "<p>Here is the version I make. It is not hers. It is as close as "
            "I have got in four years of Sundays.</p>"
            "<h2>What goes in</h2>"
            "<ul>"
            "<li>Two cups of rajma, soaked overnight — not eight hours, "
            "overnight, which in her house meant from after dinner until "
            "after the morning tea</li>"
            "<li>Three large onions, chopped much finer than you want to "
            "chop them</li>"
            "<li>Four tomatoes, pureed, plus a spoon of tomato paste if the "
            "tomatoes are the sad winter kind</li>"
            "<li>Ginger and garlic in equal parts, ground together rather "
            "than separately</li>"
            "<li>Ghee. More than feels reasonable.</li>"
            "</ul>"
            "<p>The onions are the whole recipe. She cooked them on a low "
            "flame for something like forty minutes, past golden, to a deep "
            "reddish brown that looks alarming the first time you take it "
            "that far. Every time I have rushed this the result has been "
            "fine, and fine is exactly the problem. There is no spice you can "
            "add later that replaces what those forty minutes do.</p>"
            "<h2>The part I got wrong for years</h2>"
            "<p>I used to drain the beans. She never drained the beans. That "
            "starchy, murky cooking water is what makes the gravy cling "
            "instead of sitting in a puddle around the rice, and I poured it "
            "down the sink every Sunday for two years while wondering why "
            "mine came out thin.</p>"
            "<p>The other thing is that it wants to sit. Rajma made at noon "
            "and eaten at eight is a different dish from rajma eaten at one, "
            "and she cooked in the morning for exactly that reason, then left "
            "it at the back of the stove and told anyone who lifted the lid "
            "to put it back.</p>"
            "<p>I still cannot get the last ten per cent. My aunt says it is "
            "the pressure cooker — hers was older than my mother and sealed "
            "badly in a way that apparently mattered. I think it is more "
            "likely that some of what I am trying to reproduce was never in "
            "the food.</p>"
        ),
    },
    {
        "title": "On Leaving a Job Without a Plan",
        "status": Post.Status.DRAFT,
        "published_at": None,
        "content": (
            "<p>I handed in my notice on a Tuesday with nothing lined up, "
            "which is the sort of thing that sounds brave in retrospect and "
            "felt, at the time, mostly like nausea.</p>"
            "<p>The advice is always to line something up first, and the "
            "advice is correct. I want to be careful here, because there is a "
            "genre of post that turns one person's cushioned risk into "
            "general wisdom, and I had six months of savings, no dependants, "
            "and a family who would have taken me in. That is not courage. "
            "That is a safety net described as a leap.</p>"
            "<blockquote><p>What I actually bought was not freedom. It was "
            "the ability to be bored for long enough to notice what I "
            "missed.</p></blockquote>"
            "<p>What surprised me was how long it took for my head to quiet "
            "down. I had imagined a week of decompression and then clarity. "
            "It was closer to seven weeks, and the first five were spent "
            "compulsively being productive about not having a job, which is "
            "the same anxiety wearing a different shirt.</p>"
            "<p>(Still working out how to end this one. There is something "
            "here about how the thing I missed was not the work but having "
            "people to think alongside, and I cannot yet say it without it "
            "sounding like an advert for offices.)</p>"
        ),
    },
    {
        "title": "Building in Public: Month One",
        "status": Post.Status.DRAFT,
        "published_at": None,
        "content": (
            "<p>One month in. The numbers are small enough that publishing "
            "them feels either refreshingly honest or faintly ridiculous, and "
            "I have not decided which.</p>"
            "<p>What worked: shipping something rough on day four instead of "
            "polishing for a fortnight. Three of the first ten people who "
            "tried it told me the same thing was confusing, and I would not "
            "have heard that until March otherwise.</p>"
            "<p>What did not: I have spent more time this month writing about "
            "building the thing than building it. There is a version of "
            "building in public that is just procrastination with an "
            "audience, and I have been closer to it than I would like.</p>"
            "<p>Next month: fewer updates, and one actual decision about who "
            "this is for.</p>"
        ),
    },
]
