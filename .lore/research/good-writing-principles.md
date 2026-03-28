---
title: "Research: Good Writing Principles"
date: 2026-03-27
status: complete
author: Verity
tags: [research, craft-knowledge, nudge, writing-principles]
related:
  - .lore/explorations/review-as-reflection.md
---

# Good Writing Principles

Concrete, observable patterns that experienced writers and writing teachers consistently identify as separating strong prose from weak prose. Organized by principle, not by source. Each entry covers: what the pattern is, why it matters, what the anti-pattern looks like, which sources support it, and where sources disagree.

These are craft principles for prose (essays, articles, reflective writing, professional communication). Not grammar rules, not fiction-specific advice, not stylistic preferences where reasonable people disagree.

**Confidence calibration:** Claims marked "verified across sources" appear in three or more independent authorities. Claims from a single source are marked accordingly. The cognitive reasoning ("why it matters") draws on Pinker's cognitive science framing and readability research; where I'm inferring rather than citing, I say so.

---

## 1. Characters as Subjects, Actions as Verbs

**The principle:** The subject of a sentence should be the person or thing doing something. The verb should name what they're doing. When these align, prose is clear. When they don't, the reader has to reconstruct who did what.

**Why it matters:** Williams argues this is the single most important clarity principle. Readers process sentences by looking for an agent performing an action. When the grammatical structure matches that expectation, comprehension is fast. When it doesn't (the agent is buried in a prepositional phrase, the action is hidden in a noun), the reader's working memory has to do extra parsing.

**The anti-pattern:**

> "The implementation of the new process by the team resulted in an improvement in efficiency."

vs.

> "The team implemented the new process and improved efficiency."

The first sentence has no clear agent in the subject position ("implementation" is an abstraction, not a character) and no action in the verb ("resulted in" is an empty verb). The second puts the team in the subject and their actions in the verbs.

**Observable markers:**
- Subject of the sentence is an abstraction or nominalization, not a person/entity
- Main verb is a form of "be," "have," "make," "give," "do," or "result in" paired with a nominalization
- The actual actor appears in a "by" phrase or is missing entirely

**Sources:**
- **Williams** (*Style: Lessons in Clarity and Grace*): This is his core principle. "Characters as subjects, actions as verbs" is the thesis of the book. He calls the misalignment between grammatical structure and semantic structure the primary cause of unclear prose.
- **Pinker** (*The Sense of Style*): Frames this in terms of cognitive parsing. The reader builds a mental model of who's doing what; sentences that front-load the agent and action reduce the reader's reconstruction effort.
- **Orwell** ("Politics and the English Language"): His rule "Never use the passive where you can use the active" targets the same phenomenon from the other direction: passive voice is one mechanism for removing the actor from the subject position.

**Disagreements:** None on the principle itself. Sources differ on how strictly to apply it (see Passive Voice below for the debate about when removing the actor is legitimate).

---

## 2. Nominalizations: Buried Actions

**The principle:** When a verb or adjective gets turned into a noun (decide -> decision, improve -> improvement, clear -> clarity), the action gets buried. One or two nominalizations are fine. A pattern of them makes prose feel heavy and abstract.

**Why it matters:** Nominalizations force the writer to use empty verbs ("make a decision" instead of "decide") and prepositional phrases to carry information that verbs and subjects would carry more efficiently. Each nominalization adds words without adding meaning, and shifts the prose from dynamic (things happening) to static (things existing). Williams calls this "the most common source of unnecessarily difficult prose."

**The anti-pattern:**

> "The establishment of a committee for the investigation of the failure was the recommendation of the board."

vs.

> "The board recommended establishing a committee to investigate the failure."

Four nominalizations in the first version (establishment, investigation, failure, recommendation). One in the second (failure, which is the actual subject matter, not a buried action).

**Observable markers:**
- Words ending in -tion, -ment, -ness, -ity, -ence/-ance used as sentence subjects
- Empty verbs ("make," "give," "take," "have," "do") where a more specific verb could replace the verb+noun pair
- Prepositional chain reactions: "of the X of the Y by the Z"
- Sentence subject is an event or process, not a person or entity

**Sources:**
- **Williams** (*Style*): Dedicates an entire chapter to nominalizations. His diagnostic: "If the nominalization is the subject of an empty verb, change the nominalization to a verb, find a character to be the subject, and rewrite."
- **Orwell** ("Politics and the English Language"): His examples of bad political writing are saturated with nominalizations. "Objective consideration of contemporary phenomena compels the conclusion that..."
- **Zinsser** (*On Writing Well*): Calls this "clutter" and targets the same pattern from a different angle: unnecessary nouns where verbs would do.
- **Pinker** (*The Sense of Style*): Connects nominalizations to the "curse of knowledge," noting that expert writers nominalize because the concepts feel like things to them, not realizing the reader hasn't made that conceptual shift.

**Disagreements:** None. This is as close to universal as writing advice gets. Every source examined treats nominalization density as a clarity problem.

---

## 3. Passive Voice: Default to Active, but Know When Passive Serves

**The principle:** Active voice ("The team completed the project") is the default for clear prose. Passive voice ("The project was completed") removes the actor. That's sometimes deliberate and sometimes a problem. The issue is not passive voice itself but unconscious, habitual passive that hides who did what.

**Why it matters:** Active voice makes causation and responsibility explicit. Passive voice removes agency. In prose where the reader needs to know who did what (most prose), passive makes them guess or wonder. In prose where the actor is irrelevant or deliberately obscured (lab reports, formal institutional writing), passive is the right choice.

**The anti-pattern:**

> "The project was started in January. The requirements were gathered over two weeks. The design was approved by the committee. Implementation was begun immediately."

Four consecutive passives. Who started the project? Who gathered requirements? The actors are invisible. If those actors matter, the passive is hiding relevant information. If they don't (this is a project status report where the team is obvious from context), the passive might be fine.

The real problem is clustering: four consecutive passive sentences create a monotonous, agency-free texture that's hard to read regardless of whether each individual passive is justified.

**Observable markers:**
- "was/were + past participle" constructions
- "by" phrases (explicit actor relegated to a prepositional phrase)
- Consecutive passive sentences (clustering is the stronger signal; a single passive in a paragraph of active sentences is usually fine)
- Subject of the sentence is the thing being acted on, not the actor

**Sources:**
- **Strunk & White** (*The Elements of Style*): "Use the active voice." Their most famous prescription, and also their most criticized (see Disagreements).
- **Orwell** ("Politics and the English Language"): "Never use the passive where you can use the active."
- **King** (*On Writing*): "The passive voice is safe... timid writers like passive verbs for the same reason that timid lovers like passive partners."
- **Zinsser** (*On Writing Well*): Treats passive voice as a form of clutter that weakens sentences.
- **Pinker** (*The Sense of Style*): More nuanced. Argues passive voice is a legitimate construction with specific uses (when the patient is the topic, when the agent is unknown or irrelevant) but agrees that *default* passive is a clarity problem.
- **Williams** (*Style*): Treats passive as a tool for managing information flow (putting old information first). Doesn't condemn it but identifies when it obscures the actor unnecessarily.

**Disagreements:** This is the principle where sources diverge most.

- **Pullum** (linguist, "50 Years of Stupid Grammar Advice" in *The Chronicle of Higher Education*): Argued that Strunk & White couldn't even correctly identify passive voice (three of their four examples were wrong). The blanket prescription "use the active voice" is based on a misunderstanding of what passive voice is.
- **Pinker and Williams** both argue against the blanket rule. Passive is a tool. The question is whether it's deployed consciously.
- **The consensus position** (verified across sources): Default to active. Use passive deliberately when the actor is irrelevant, unknown, or when information flow requires it. The problem is not passive voice; it's unconscious, habitual passive that hides responsibility and agency. Clustering (multiple consecutive passives) is a stronger signal of a problem than any individual instance.

**For the nudge function:** This principle requires care. The nudge should never say "avoid passive voice." It should flag *clustering* or *actor removal in contexts where the actor matters* and ask whether it was intentional. A single passive sentence should almost never trigger a nudge.

---

## 4. Cut Unnecessary Words

**The principle:** Every word should earn its place. Qualifiers, throat-clearers, redundant phrases, and filler weaken prose by diluting the signal. If you can remove a word without changing the meaning, remove it.

**Why it matters:** Cognitive load research shows working memory handles 5-9 chunks of information at once. Every unnecessary word consumes part of that capacity without adding meaning. Zinsser frames it as respecting the reader's time. Orwell frames it as intellectual honesty: vague, padded prose is often a sign of vague, unexamined thinking.

**The anti-pattern:**

> "In order to facilitate the process of decision-making, it is important to note that there are a number of factors that need to be taken into consideration."

vs.

> "Several factors affect this decision."

The first sentence is 28 words. The second is 6. They say the same thing.

**Observable markers:**
- Filler phrases: "it is important to note that," "there is/are," "the fact that," "in order to," "due to the fact that," "at this point in time"
- Redundant pairs: "each and every," "first and foremost," "basic and fundamental"
- Qualifiers that add no precision: "very," "really," "quite," "somewhat," "rather," "fairly" (when they don't modify meaning)
- Adverbs that duplicate the verb: "completely finished," "totally destroyed," "seriously considered"
- Sentences that could be cut entirely without losing information

**Sources:**
- **Zinsser** (*On Writing Well*): "Clutter is the disease of American writing." His entire opening section is about stripping sentences to their cleanest components.
- **Strunk & White** (*The Elements of Style*): "Omit needless words." Rule 17, possibly the most quoted writing advice in English.
- **Orwell** ("Politics and the English Language"): "If it is possible to cut a word out, always cut it out."
- **King** (*On Writing*): "The road to hell is paved with adverbs." Argues that most adverbs signal a verb that wasn't strong enough in the first place.
- **Pinker** (*The Sense of Style*): More tolerant of intensifiers than other sources, but agrees that throat-clearing and padding are clarity problems.

**Disagreements:** Minor. King and Zinsser are stricter about adverbs than Pinker, who argues some adverbs serve legitimate functions (emphasis, precision). The core principle (remove words that add no meaning) is universal. The argument is about where the line is, not whether the line exists.

---

## 5. Concrete Over Abstract

**The principle:** Strong prose uses concrete nouns and specific details. Weak prose retreats into abstractions, generalizations, and vague language. "A large dog" is abstract. "A German shepherd" is concrete. "Experienced significant growth" is abstract. "Revenue doubled" is concrete.

**Why it matters:** Concrete language activates sensory and spatial processing in the brain. Abstract language requires the reader to fill in the specifics from their own experience, which may not match the writer's intent. Pinker frames this as the difference between showing the reader a scene and asking them to imagine one. The reader who sees "German shepherd" has a picture. The reader who sees "large dog" has to generate one.

**The anti-pattern:**

> "The situation involved a number of challenges that impacted various stakeholders across multiple domains."

Every noun is abstract (situation, challenges, stakeholders, domains). The reader has no picture of what happened, who was affected, or what the challenges were.

**Observable markers:**
- Abstract nouns as subjects: "situation," "issue," "factor," "aspect," "element," "dynamic"
- Vague quantifiers: "a number of," "various," "multiple," "significant," "substantial"
- Missing specifics: who, what, when, where replaced by generalizations
- Verb phrases that avoid naming the action: "was involved in," "had an impact on," "played a role in"

**Sources:**
- **Orwell** ("Politics and the English Language"): His dying metaphor critique targets abstract, pre-packaged language that substitutes for concrete thought. His rule: "Never use a metaphor, simile, or other figure of speech which you are used to seeing in print."
- **Zinsser** (*On Writing Well*): "Prefer concrete nouns and strong verbs over abstract nouns and heavy adjectives/adverbs."
- **King** (*On Writing*): "Use the first word that comes to your mind, if it is appropriate and colorful." Opposes reaching for impressive abstractions when a plain concrete word is available.
- **Pinker** (*The Sense of Style*): His "classic style" is built on the premise that good prose makes the reader see something. Abstraction prevents that.
- **Plain language movement**: Federal Plain Language Guidelines and readability research consistently find that concrete language improves comprehension across audiences.

**Disagreements:** None on the principle. Some tension on degree: academic and professional writing sometimes requires abstraction when discussing concepts that are genuinely abstract. The principle is "prefer concrete when you have the choice," not "never use abstract language."

---

## 6. Sentence Rhythm Variation

**The principle:** Vary sentence length. A passage where every sentence falls in the same word-count range creates a metronomic rhythm that lulls the reader. Short sentences punch. Long sentences develop and qualify. The variation itself creates emphasis and momentum.

**Why it matters:** Readability research shows readers comprehend short sentences (8-14 words) more easily than long ones (25+ words). But a passage of nothing but short sentences feels choppy and childish, while nothing but long sentences feels dense and exhausting. The sweet spot is variation: an average of 15-20 words with significant range around that average. The short sentence after a series of long ones creates emphasis. The long sentence after a series of short ones creates flow.

**The anti-pattern:**

Twelve consecutive sentences at 18-22 words each. No variation. The rhythm flatlines. Individual sentences may be fine, but the passage as a whole has no shape.

Also: a series of short, declarative sentences with identical structure.

> "The team met on Monday. They discussed the budget. The budget was too high. They decided to cut costs. The cuts were painful. The project continued."

Every sentence follows the same subject-verb-object pattern at the same length. The content may vary but the rhythm says "nothing here matters more than anything else."

**Observable markers:**
- Standard deviation of sentence length across a paragraph or section (low variance = monotony)
- Maximum consecutive sentences in the same length band (e.g., 10 sentences all between 15-25 words)
- Absence of short sentences (under 8 words) across an entire section
- Absence of sentences over 25 words across an entire section (suggests the writer is avoiding complexity)

**Sources:**
- **King** (*On Writing*): Advocates varying sentence length and structure to create pace and emphasis.
- **Zinsser** (*On Writing Well*): Discusses rhythm as a function of sentence variety.
- **Pinker** (*The Sense of Style*): Treats prose rhythm as part of the reader's experience of "voice."
- **Readability research**: Studies show comprehension correlates with sentence length, and that variation in length improves engagement. Historical trend data shows average sentence length in published prose has shortened over the past century, from 33 words (1876-1900) to 27 words (1976-2000) in scientific prose.

**Disagreements:** None on the principle of variation. Some disagreement on ideal average length (readability formulas suggest 15-20 words; literary prose often runs longer). The universal claim is about *variation*, not about a specific target length.

---

## 7. Lead with the Point

**The principle:** The reader should encounter the most important information early. In a paragraph, the opening sentence should signal what the paragraph is about. In a section, the opening paragraph should signal the section's purpose. Information that arrives late, after extensive setup, is a "buried lead."

**Why it matters:** Readers allocate attention based on what they encounter first. Cognitive research on primacy effects shows that information presented early in a sequence is remembered better. When the point arrives in sentence 7 of a paragraph, the reader has spent six sentences building a mental model that may need to be restructured once the point lands. Williams calls this the "topic position": the beginning of a sentence (or paragraph) tells the reader what the sentence is about.

**The anti-pattern:**

> "The quarterly review meeting took place on Tuesday. Several teams presented their progress. Marketing showed a new campaign. Sales reported steady numbers. Engineering discussed their roadmap. Customer success shared retention data. Then the CFO announced the company is being acquired."

The most consequential information is in the last sentence. Everything before it is routine setup. The reader reaches the acquisition news only after investing attention in six sentences of context that, in retrospect, doesn't matter relative to the lead.

**Observable markers:**
- Paragraphs where the most specific/consequential claim appears in the final sentence
- Sections that begin with context-setting or throat-clearing rather than a topic statement
- Multiple paragraphs of setup before the first substantive claim
- The word "however" or "but" appearing mid-paragraph, followed by the actual point (the preceding sentences set up what's being contradicted, but the contradiction is the news)

**Sources:**
- **Zinsser** (*On Writing Well*): Treats the lead as the most important sentence. "The most important sentence in any article is the first one."
- **Williams** (*Style*): His "topic position" principle: the beginning of a sentence signals what the sentence is about. Extended to paragraphs: the opening sentence signals what the paragraph is about.
- **Journalism tradition**: "Don't bury the lede" is the foundational principle of news writing and has been adopted broadly in professional communication.
- **Pinker** (*The Sense of Style*): Discusses this in terms of the "given-new contract": readers expect the beginning of a unit to orient them before new information arrives. But the orienting information should be brief, not six sentences of warmup.

**Disagreements:** Some sources allow for deliberate suspense or build-up (delaying the point for rhetorical effect). The consensus: burying the lead is almost always unintentional, and intentional delay should be rare and purposeful.

---

## 8. Old Information Before New

**The principle:** Each sentence should begin with information the reader already knows (from the previous sentence, from shared context) and end with the new information. This creates a chain where each sentence connects to the last, and the new information lands in the "stress position" at the end where it gets the most emphasis.

**Why it matters:** This is a cognitive processing principle. Readers parse sentences left to right. If the first thing they encounter is unfamiliar, they have no framework to attach it to. If the first thing is familiar, it activates existing knowledge, and the new information at the end extends that knowledge. Williams calls this the primary mechanism of coherent prose.

**The anti-pattern:**

> "A novel compound was synthesized by the research team. Significant anti-inflammatory properties were discovered during testing. Reduced swelling in rat models by 40% was the most notable result."

Each sentence leads with new, unfamiliar information. The reader can't connect each sentence to the previous one without re-reading. Compare:

> "The research team synthesized a novel compound. The compound showed significant anti-inflammatory properties during testing. Most notably, it reduced swelling in rat models by 40%."

Same information, but each sentence begins with the previous sentence's endpoint.

**Observable markers:**
- Sentences that begin with information not mentioned in the preceding sentence or established context
- Abrupt topic shifts between consecutive sentences
- Lack of connecting words or repeated references between sentences
- Reader has to re-read to understand how sentences relate

**Sources:**
- **Williams** (*Style*): His "old-to-new" principle. He considers this one of the five major principles of clear writing: "characters as subjects, actions as verbs, old before new, short before long, topic then stress."
- **Pinker** (*The Sense of Style*): Discusses the "given-new contract" from psycholinguistics. Readers expect given information at the beginning of a clause and new information at the end.
- **Cognitive science**: The given-new contract is a well-established finding in psycholinguistics research, not just a stylistic preference. It reflects how working memory processes sequential information.

**Disagreements:** None on the principle. This is grounded in cognitive science, not opinion. The only debate is about how rigidly to apply it (sometimes a topic shift is necessary and should be signaled with a transition rather than forced into old-new structure).

---

## 9. Hedging Accumulation

**The principle:** A single hedge ("I think," "perhaps," "might") can signal appropriate uncertainty. Multiple hedges in the same sentence or passage signal a writer who doesn't trust their own point. The accumulation is the problem, not any individual hedge.

**Why it matters:** Each hedge reduces the sentence's commitment. One hedge says "I'm being thoughtful about certainty." Three hedges say "I'm not sure I should be saying this." Readers calibrate their trust in the writer's authority based on how committed the prose sounds. Accumulated hedging reads as evasion, not precision.

**The anti-pattern:**

> "I think it might possibly be somewhat relevant to perhaps consider whether the approach could potentially work in some situations."

Nine hedging markers in one sentence: "I think," "might," "possibly," "somewhat," "perhaps," "consider whether," "could," "potentially," "some." The sentence commits to nothing.

**Observable markers:**
- Multiple hedging words in a single sentence: "might," "could," "possibly," "perhaps," "somewhat," "I think," "it seems," "tend to," "in some ways"
- Hedging density: count of hedging markers per sentence or paragraph
- Consecutive hedged claims with no committed statement between them
- Qualifier stacking: "might possibly," "could potentially," "somewhat fairly"

**Sources:**
- **Zinsser** (*On Writing Well*): Targets qualifiers and hedges as clutter. "Don't say you were a bit confused and sort of tired and a little depressed and somewhat annoyed. Be confused. Be tired. Be depressed. Be annoyed."
- **Pinker** (*The Sense of Style*): Discusses hedging in the context of "classic style," which assumes the writer has something to say and says it directly. Excessive hedging breaks the "classic style" contract.
- **Williams** (*Style*): Treats unnecessary hedging as a form of metadiscourse that distances the writer from their own claims.
- **Academic writing research**: Studies on hedging in academic prose distinguish between epistemic hedging (legitimate uncertainty signaling) and habitual hedging (writer insecurity). The former serves the reader; the latter is noise.

**Disagreements:** None on the accumulation principle. Sources disagree on individual hedges: academic writing tolerates and even expects hedging ("our results suggest") that would be excessive in journalism or professional communication. The universal principle is about accumulation, not individual instances.

**For the nudge function:** Count hedges per sentence or per paragraph. A single hedge almost never warrants a nudge. Three or more in a sentence, or a sustained pattern across a paragraph, is worth asking about.

---

## 10. Unclear Antecedents

**The principle:** Every pronoun and demonstrative ("this," "that," "it," "they," "which") should have an unambiguous referent. When the reader has to guess what "it" refers to, the prose has failed at its basic job.

**Why it matters:** Pronouns are shortcuts. They work when the referent is obvious. When multiple possible referents exist, the reader has to pause and disambiguate, which breaks the flow of comprehension. The writer always knows what "it" means because they just thought it. The reader hasn't.

**The anti-pattern:**

> "The committee reviewed the proposal and sent it to the board. They discussed it at length but couldn't agree on it, so they sent it back."

"They" appears twice, referring to different groups (committee, then board). "It" appears three times, and by the third instance, it's unclear whether "it" is the proposal, the committee's review, or the board's feedback.

**Observable markers:**
- "This" or "it" at the start of a sentence with no clear antecedent in the previous sentence
- "They" used when multiple groups have been mentioned
- "Which" in a relative clause where two nouns could be the antecedent
- Pronouns referring to concepts or clauses rather than specific nouns ("This is important" where "this" refers to... the whole preceding paragraph?)

**Sources:**
- **Strunk & White** (*The Elements of Style*): Prescribes clear antecedents as a basic requirement.
- **Williams** (*Style*): Discusses ambiguous reference as a coherence problem.
- **Pinker** (*The Sense of Style*): Treats ambiguous pronouns as a manifestation of the curse of knowledge: the writer knows what "it" means, so they don't notice the ambiguity.
- **Every writing handbook**: This is so universally taught that it barely needs sourcing. The reason it's worth including here is that it's invisible to the writer and obvious to the reader, making it a high-value nudge target.

**Disagreements:** None. This is a clarity problem, not a style preference.

---

## 11. The Curse of Knowledge

**The principle:** Writers assume readers know what they know. They skip context, use jargon without definition, omit intermediate reasoning steps, and reference things the reader hasn't been introduced to. This is not carelessness; it's a cognitive bias. The writer literally cannot simulate the reader's ignorance because they can't un-know what they know.

**Why it matters:** Pinker calls this "the chief contributor to opaque writing." It explains why expert writers often produce less readable prose than competent non-experts: the expert has internalized so much that they can't identify what needs to be stated explicitly. The reader encounters gaps, undefined terms, and logical jumps that the writer doesn't perceive as gaps.

**The anti-pattern:**

> "We used a standard DI approach with route factories, which simplified testing via app.request()."

Clear to someone who knows dependency injection, route factories, and Hono's testing API. Opaque to anyone else. The writer doesn't notice the assumed knowledge because it's not assumed to them; it's just known.

**Observable markers:**
- Technical terms or jargon used without definition or context
- Logical leaps: a conclusion that doesn't follow from the stated premises (the missing premise is in the writer's head)
- Implicit references: "as discussed," "the usual approach," "standard practice" without specifying what's usual or standard
- Acronyms introduced without expansion
- Sentences that require domain knowledge to parse

**Sources:**
- **Pinker** (*The Sense of Style*): The curse of knowledge is a centerpiece of his book. He defines it as "the failure to understand that other people don't know what we know" and argues it's the single biggest barrier to clear writing.
- **Cognitive science**: The curse of knowledge is a well-documented cognitive bias (Camerer, Loewenstein, & Weber, 1989). It's not a writing-specific concept; Pinker applied existing cognitive science to the writing domain.
- **Zinsser** (*On Writing Well*): Discusses the same phenomenon as "assuming too much of the reader" without using the term.
- **Plain language movement**: The entire plain language movement is essentially a systematic response to the curse of knowledge in institutional writing.

**Disagreements:** None on the existence or importance of the bias. Some debate about how much context a writer should provide (too much context is also a problem; it's condescending to readers who do have the knowledge). The principle is about noticing the gap, not about always filling it.

**For the nudge function:** This principle is harder to detect mechanically than the others. The nudge function would rely on the LLM's judgment about whether terms, references, or logical steps assume knowledge the text hasn't established. The metrics pipeline can flag jargon density and acronym usage, but the deeper pattern (unstated assumptions) requires language model interpretation.

---

## 12. Dangling and Misplaced Modifiers

**The principle:** A modifier should sit next to the thing it modifies. When it doesn't, the sentence says something the writer didn't mean. "Walking down the street, the trees were beautiful" says the trees were walking. The writer didn't notice because they know who was walking. The reader doesn't.

**Why it matters:** Dangling modifiers create momentary confusion or unintentional comedy. They're invisible to the writer (who knows the intended meaning) and distracting to the reader (who has to reconstruct it). Like unclear antecedents, they're a "writer knows, reader doesn't" problem.

**The anti-pattern:**

> "After reviewing the data, the report was submitted to management."

Who reviewed the data? The report didn't. The person who reviewed the data is missing from the sentence.

> "Covered in mud, I could see the dog had been digging."

The sentence says "I" was covered in mud. The dog was covered in mud.

**Observable markers:**
- Participial phrases (-ing, -ed) at the beginning of a sentence where the subject of the main clause is not the agent of the participial action
- "While," "after," "before" + action where the implied subject doesn't match the grammatical subject
- Prepositional phrases placed far from the noun they modify

**Sources:**
- **Strunk & White** (*The Elements of Style*): Covers misplaced modifiers as a basic clarity requirement.
- **Williams** (*Style*): Discusses modifier placement as part of sentence architecture.
- **Pinker** (*The Sense of Style*): Treats dangling modifiers as a specific manifestation of the curse of knowledge.
- **Purdue OWL, university writing centers**: Universally taught as a fundamental writing error, appearing in essentially every writing handbook.

**Disagreements:** None. This is a clarity error, not a style choice. The only nuance: some dangling modifiers are so conventional ("Considering the circumstances, it seems...") that they read naturally despite being technically incorrect. Strict enforcement would flag constructions that no reader actually misreads.

**For the nudge function:** Worth flagging, but with the acknowledgment that some conventional dangling modifiers are idiomatic. The nudge should focus on cases where the modifier genuinely creates ambiguity about who did what, not on technically-incorrect-but-universally-understood constructions.

---

## Principles Considered and Excluded

The following patterns appear in some craft sources but were excluded because they fall into "stylistic preferences where reasonable people disagree" rather than "universal craft principles."

**Sentence fragments:** King and some journalism traditions use fragments deliberately for emphasis. Academic and professional writing traditions treat them as errors. Context-dependent, not universal.

**First person usage:** Some style guides discourage "I" in professional and academic writing. Others (Zinsser, King) encourage it as more honest and direct. This is a register choice, not a craft principle.

**Paragraph length:** Long paragraphs are discouraged in web writing and journalism, tolerated in academic writing, and expected in literary criticism. No universal standard.

**Exclamation marks:** King says to use no more than two or three per 100,000 words. Zinsser agrees. But this is closer to a taste preference than a clarity principle. Exclamation marks don't impair comprehension; they just signal a particular register.

**Contractions:** Some style guides prohibit them; others require them for naturalness. Register-dependent.

**"To be" verbs:** Some writing advice treats all forms of "be" as weak. Williams and Pinker both argue this is an overcorrection; "be" is often the right verb. The principle is about *empty* verbs paired with nominalizations (Principle 2), not about "be" in general.

---

## Source Assessment

**Strongest convergence (all major sources agree):**
- Nominalizations bury action (Principles 1, 2)
- Cut unnecessary words (Principle 4)
- Concrete beats abstract (Principle 5)
- Vary sentence rhythm (Principle 6)
- Unclear antecedents impair comprehension (Principle 10)

**Strong convergence (most sources agree, some add nuance):**
- Default to active voice, but passive has uses (Principle 3)
- Lead with the point (Principle 7)
- Old before new (Principle 8)
- Hedging accumulation signals weak commitment (Principle 9)

**Cognitive science grounding (empirical, not just opinion):**
- Curse of knowledge (Principle 11): documented cognitive bias
- Old before new (Principle 8): given-new contract from psycholinguistics
- Sentence length and comprehension (Principle 6): readability research
- Cognitive load and unnecessary words (Principle 4): working memory research

**Sources with known limitations:**
- **Strunk & White**: Highly influential but linguistically imprecise. Pullum's criticism that they couldn't identify passive voice correctly is well-documented. Their prescriptions are directionally correct but their explanations are unreliable. Use their principles, not their definitions.
- **Orwell**: His rules are stated as absolutes ("never use...") but his sixth rule ("break any of these rules sooner than say anything outright barbarous") acknowledges context-dependence. His essay is a polemic, not a reference work.

---

## Implications for the Nudge Function

These twelve principles sort into three categories by how they can be detected:

**Metrically detectable** (the existing metrics pipeline can flag these):
- Passive voice clustering (sentence-structure.ts already detects passive voice)
- Sentence rhythm monotony (rhythm.ts already computes length sequences)
- Hedging accumulation (word-frequency.ts already detects hedging words)
- Nominalization density (detectable by suffix patterns: -tion, -ment, -ness, -ity, -ence)

**Partially metrically detectable** (metrics provide evidence, LLM interprets):
- Unnecessary words/clutter (filler phrase detection is mechanical; judging whether a specific word is unnecessary requires context)
- Abstract vs. concrete language (some markers are detectable by word frequency/category; full judgment requires semantic understanding)

**LLM-dependent** (require language model judgment):
- Buried leads (requires understanding which information is most consequential)
- Old-before-new violations (requires tracking information flow across sentences)
- Unclear antecedents (requires coreference resolution in context)
- Curse of knowledge (requires assessing whether terms and reasoning steps are accessible)
- Dangling modifiers (requires parsing modifier attachment)
- Characters-as-subjects alignment (requires semantic role analysis)

The first category is ready for implementation today. The second category benefits from a metrics+LLM hybrid approach. The third category is LLM territory, and the nudge prompt should direct the LLM's attention to these patterns specifically.
