import type { QuestionCategory, QuizQuestion } from "./types";

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  everyday: "Everyday",
  creative: "Creative",
  personal: "Personal",
  education: "Education",
  work: "Work",
  civic: "Civic",
  media: "Media",
  money: "Money",
  conflict: "Conflict",
  "high-stakes": "High stakes",
};

export const AI_ACCEPTABILITY_QUESTIONS = [
  {
    id: "trip-plan",
    category: "everyday",
    agency: "assist",
    prompt: "Is AI acceptable for planning a trip itinerary?",
    context: "You choose the destination and review every booking yourself.",
    yesChallenge:
      "What about an itinerary that quietly favours businesses that paid to appear?",
    noChallenge:
      "What about a disabled traveller who already chose every stop but needs help arranging an accessible route?",
  },
  {
    id: "automatic-purchases",
    category: "everyday",
    agency: "delegate",
    prompt:
      "Is AI acceptable for buying household items without asking each time?",
    context: "It chooses products and places orders within a monthly budget.",
    yesChallenge:
      "What about brands paying to become the default while small local businesses never appear as options?",
    noChallenge:
      "What about a system that may only reorder exact products you approved and must stay below a strict limit?",
  },
  {
    id: "creative-brainstorm",
    category: "creative",
    agency: "assist",
    prompt: "Is AI acceptable for brainstorming concepts for a new artwork?",
    context: "A human artist selects, combines, and executes the final idea.",
    yesChallenge:
      "What about suggestions that closely mirror a living artist's distinctive style?",
    noChallenge:
      "What about an artist with a motor disability who can direct ideas verbally but cannot make exploratory sketches unaided?",
  },
  {
    id: "synthetic-album",
    category: "creative",
    agency: "delegate",
    prompt:
      "Is AI acceptable for creating and releasing an entire album under a human artist's name?",
    context:
      "The artist provides a prompt but does not meaningfully edit the result.",
    yesChallenge:
      "What about listeners who believe the named artist composed and performed work they barely reviewed?",
    noChallenge:
      "What about an artist who can no longer perform because of illness but directs every creative decision?",
  },
  {
    id: "eulogy",
    category: "personal",
    agency: "assist",
    prompt: "Is AI acceptable for helping write a eulogy for someone you knew?",
    context:
      "The speaker supplies the memories and rewrites the final text before reading it.",
    yesChallenge:
      "What about a funeral platform using private memories to sell a polished version of grief back to the family?",
    noChallenge:
      "What about someone whose grief or disability makes writing the eulogy alone effectively impossible?",
  },
  {
    id: "emotional-replies",
    category: "personal",
    agency: "delegate",
    prompt:
      "Is AI acceptable for automatically replying to emotional messages from close friends?",
    context: "The recipient is not told that the replies are automated.",
    yesChallenge:
      "What about a friend believing they are receiving your time and care while a company quietly performs the relationship for you?",
    noChallenge:
      "What about a person with a motor disability who reviews the meaning of each reply but cannot type it unaided?",
  },
  {
    id: "math-tutor",
    category: "education",
    agency: "assist",
    prompt:
      "Is AI acceptable for explaining where a student went wrong in a maths problem?",
    context: "The AI gives hints and explanations but not the final answer.",
    yesChallenge:
      "What about schools using tutoring conversations to profile students and decide which opportunities they should receive?",
    noChallenge:
      "What about a student whose only affordable one-to-one tutor is the AI?",
  },
  {
    id: "graded-essay",
    category: "education",
    agency: "delegate",
    prompt:
      "Is AI acceptable for writing an essay that a student submits for a grade?",
    context:
      "The assignment is intended to assess the student's own writing and reasoning.",
    yesChallenge:
      "What about a student who can defend every idea but did none of the writing the course is assessing?",
    noChallenge:
      "What about a disabled student who dictates every idea while AI only turns their speech into sentences?",
  },
  {
    id: "meeting-summary",
    category: "work",
    agency: "assist",
    prompt:
      "Is AI acceptable for summarising a work meeting and extracting action items?",
    context:
      "A participant checks the summary before it is shared with the team.",
    yesChallenge:
      "What about management using the summaries to score who speaks enough, turning a convenience into workplace surveillance?",
    noChallenge:
      "What about a deaf employee who needs a searchable transcript to participate on equal terms with hearing colleagues?",
  },
  {
    id: "applicant-shortlist",
    category: "work",
    agency: "delegate",
    prompt:
      "Is AI acceptable for choosing which job applicants reach a human interview?",
    context:
      "The model is audited, but rejected applicants cannot appeal to a person.",
    yesChallenge:
      "What about a qualified applicant rejected because a cancer-related employment gap predicts low commitment?",
    noChallenge:
      "What about 40,000 applicants where the system only checks whether each person holds the legally required licence?",
  },
  {
    id: "policy-explainer",
    category: "civic",
    agency: "assist",
    prompt:
      "Is AI acceptable for translating a council proposal into plain language?",
    context:
      "The original proposal is linked and officials check the summary for accuracy.",
    yesChallenge:
      "What about officials choosing the prompt and framing, then presenting the resulting summary as politically neutral?",
    noChallenge:
      "What about residents with cognitive disabilities who cannot meaningfully participate when the only version is dense legal prose?",
  },
  {
    id: "benefits-eligibility",
    category: "civic",
    agency: "delegate",
    prompt:
      "Is AI acceptable for deciding whether someone receives public benefits?",
    context:
      "The decision uses government records and has no automatic human review.",
    yesChallenge:
      "What about a government using automation mainly to cut staff while claimants must spend weeks proving the system treated them unfairly?",
    noChallenge:
      "What about AI instantly approving clear cases while every possible refusal goes to a person?",
  },
  {
    id: "scan-second-opinion",
    category: "high-stakes",
    agency: "assist",
    prompt:
      "Is AI acceptable for giving a doctor a second opinion on a medical scan?",
    context:
      "The doctor remains responsible for the diagnosis and treatment decision.",
    yesChallenge:
      "What about a hospital using the tool to double each doctor's caseload while still calling every decision human-led?",
    noChallenge:
      "What about a system that consistently catches rare cancers doctors overlook?",
  },
  {
    id: "insurance-claims",
    category: "high-stakes",
    agency: "delegate",
    prompt:
      "Is AI acceptable for approving or denying health-insurance claims?",
    context:
      "The system makes the initial decision without a clinician reviewing every case.",
    yesChallenge:
      "What about the insurer choosing a model that saves the most money when every denied patient bears the cost of appealing?",
    noChallenge:
      "What about AI approving straightforward claims instantly while every possible denial receives human review?",
  },
  {
    id: "photo-restoration",
    category: "creative",
    agency: "assist",
    prompt:
      "Is AI acceptable for restoring missing details in a damaged family photograph?",
    context:
      "The edited image is labelled as a reconstruction rather than an untouched original.",
    yesChallenge:
      "What about a changed face that the family later remembers as an authentic image?",
    noChallenge:
      "What about the damaged photograph being the only surviving image through which a child can recognise an ancestor?",
  },
  {
    id: "breakup-message",
    category: "personal",
    agency: "delegate",
    prompt: "Is AI acceptable for writing and sending a breakup message?",
    context:
      "The sender chooses the goal, but the AI writes and sends the message without review.",
    yesChallenge:
      "What about gentle wording that hides the sender's real feelings and creates false hope?",
    noChallenge:
      "What about someone leaving an abusive relationship who needs a safe, unemotional message?",
  },
  {
    id: "recipe-suggestions",
    category: "everyday",
    agency: "assist",
    prompt:
      "Is AI acceptable for suggesting recipes from the food already in your kitchen?",
    context:
      "You check allergies, ingredients, and cooking instructions yourself.",
    yesChallenge:
      "What about sponsored ingredients appearing first while affordable local or culturally specific foods are barely represented?",
    noChallenge:
      "What about suggestions restricted to a verified allergen-safe ingredient list?",
  },
  {
    id: "parole-decision",
    category: "civic",
    agency: "delegate",
    prompt: "Is AI acceptable for deciding whether a prisoner receives parole?",
    context:
      "The system predicts risk and its recommendation is treated as the final decision.",
    yesChallenge:
      "What about historical arrest data that reflects biased policing rather than a person's actual risk?",
    noChallenge:
      "What about AI only surfacing comparable cases while a human panel must justify its own decision?",
  },
  {
    id: "news-summary",
    category: "media",
    agency: "assist",
    prompt:
      "Is AI acceptable for summarising conflicting reporting on a breaking story?",
    context:
      "A journalist checks the summary and links readers to every original source.",
    yesChallenge:
      "What about a concise summary that gives equal weight to strong evidence and deliberate propaganda?",
    noChallenge:
      "What about an editor facing hundreds of reports during a disaster while AI only extracts attributed quotes?",
  },
  {
    id: "automatic-breaking-news",
    category: "media",
    agency: "delegate",
    prompt: "Is AI acceptable for publishing breaking news without an editor?",
    context:
      "The system verifies several sources, writes the report, and publishes immediately.",
    yesChallenge:
      "What about publishers using instant AI reporting to eliminate local newsrooms, leaving nobody accountable to the community being covered?",
    noChallenge:
      "What about an earthquake warning built from official sensors where a human delay could cost lives?",
  },
  {
    id: "spending-patterns",
    category: "money",
    agency: "assist",
    prompt:
      "Is AI acceptable for warning someone about harmful spending patterns?",
    context:
      "It analyses private bank transactions and sends suggestions only to the account holder.",
    yesChallenge:
      "What about the bank learning which customers seem vulnerable, then using that insight to market them more profitable credit?",
    noChallenge:
      "What about an on-device warning that prevents a missed rent payment and never shares the transaction data?",
  },
  {
    id: "retirement-trading",
    category: "money",
    agency: "delegate",
    prompt: "Is AI acceptable for autonomously trading retirement savings?",
    context:
      "The owner chooses a risk level, but the system makes every individual trade.",
    yesChallenge:
      "What about the provider steering savings into its own funds or toward trades that generate fees for the provider?",
    noChallenge:
      "What about a regulated system that consistently outperforms human managers while charging almost nothing?",
  },
  {
    id: "ceasefire-translation",
    category: "conflict",
    agency: "assist",
    prompt:
      "Is AI acceptable for translating ceasefire proposals during active negotiations?",
    context:
      "Human negotiators review the translation before accepting any agreement.",
    yesChallenge:
      "What about the translation system being owned by one side's defence contractor, whose preferred language shapes what compromise sounds reasonable?",
    noChallenge:
      "What about opponents with no shared language and only hours to stop an attack?",
  },
  {
    id: "military-targets",
    category: "conflict",
    agency: "delegate",
    prompt: "Is AI acceptable for selecting military targets?",
    context:
      "The system confirms a target and authorises the strike without a human decision.",
    yesChallenge:
      "What about automation making strikes politically easier to authorise because no individual feels fully responsible for the death?",
    noChallenge:
      "What about an incoming armed drone where an automated interceptor has seconds to respond?",
  },
  {
    id: "explain-death",
    category: "personal",
    agency: "assist",
    prompt:
      "Is AI acceptable for helping a parent explain death to a young child?",
    context:
      "The parent describes the family's beliefs and reviews every word before using it.",
    yesChallenge:
      "What about a technology company becoming the quiet intermediary that standardises how families explain grief, faith, and death?",
    noChallenge:
      "What about a grieving parent who cannot find age-appropriate words before the child attends a funeral?",
  },
  {
    id: "memorial-chatbot",
    category: "personal",
    agency: "delegate",
    prompt: "Is AI acceptable for impersonating someone who died?",
    context:
      "The chatbot is trained on their messages and speaks as if it is still that person.",
    yesChallenge:
      "What about a company charging indefinitely for access to a simulation built from a dead person's private words and identity?",
    noChallenge:
      "What about a person with dementia using familiar conversations to preserve a comforting daily routine?",
  },
  {
    id: "accessibility-descriptions",
    category: "creative",
    agency: "assist",
    prompt:
      "Is AI acceptable for generating accessibility descriptions for visual art?",
    context:
      "The artist reviews the description before blind and low-vision visitors receive it.",
    yesChallenge:
      "What about galleries replacing blind describers and educators with one standardised machine perspective chosen by the platform?",
    noChallenge:
      "What about a small gallery that otherwise cannot describe thousands of works to blind visitors?",
  },
  {
    id: "unfinished-novel",
    category: "creative",
    agency: "delegate",
    prompt: "Is AI acceptable for finishing a dead author's novel?",
    context:
      "The model uses the author's published work and the result is marketed as the official ending.",
    yesChallenge:
      "What about an author who deliberately destroyed the final draft because they did not want it published?",
    noChallenge:
      "What about an unfinished story central to an endangered language, where a new ending could help keep young readers engaged with it?",
  },
  {
    id: "performance-review",
    category: "work",
    agency: "assist",
    prompt:
      "Is AI acceptable for helping a manager prepare an employee's performance review?",
    context:
      "It analyses work documents and messages, but the manager writes the final assessment.",
    yesChallenge:
      "What about a private message becoming evidence of poor attitude without the employee knowing it was analysed?",
    noChallenge:
      "What about a remote employee whose best work the manager overlooked until the system surfaced it?",
  },
  {
    id: "automatic-grading",
    category: "education",
    agency: "delegate",
    prompt: "Is AI acceptable for grading students without an appeal?",
    context:
      "The system reads the work, assigns the final grade, and gives written feedback.",
    yesChallenge:
      "What about affluent schools retaining teacher feedback while underfunded schools make automated grading the only judgement students receive?",
    noChallenge:
      "What about ten thousand exams where the system removes favouritism and applies the same published rubric to everyone?",
  },
] as const satisfies readonly QuizQuestion[];
