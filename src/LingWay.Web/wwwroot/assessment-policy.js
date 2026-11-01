"use strict";

// Mirrors Assessment.cs. Parity is checked by tests, including offline answers.
const assessmentPolicy = {
  normalize(value) {
    let text = String(value ?? "").toLowerCase().replaceAll("’", "'");
    const forms = {"i'm":"i am","you're":"you are","we're":"we are","they're":"they are","it's":"it is","that's":"that is","i've":"i have","we've":"we have","i'll":"i will","we'll":"we will","can't":"cannot","won't":"will not"};
    for (const [from,to] of Object.entries(forms)) text = text.replace(new RegExp("\\b"+from+"\\b", "g"),to);
    return text.replace(/\b(don|doesn|didn|isn|aren|wasn|weren|haven|hasn|hadn|wouldn|shouldn|couldn)'t\b/g, (_,base)=>base.slice(0,-1)+" not")
      .replace(/[^\p{L}\p{N}_\s]/gu, "").replace(/\s+/g, " ").trim();
  },
  similarity(a, b) {
    if (!a.length && !b.length) return 1;
    function match(a0, a1, b0, b1) {
      let best = 0, ai = a0, bi = b0, previous = new Array(b.length + 1).fill(0);
      for (let i = a0; i < a1; i++) {
        const current = new Array(b.length + 1).fill(0);
        for (let j = b0; j < b1; j++) if (a[i] === b[j]) {
          current[j + 1] = previous[j] + 1;
          if (current[j + 1] > best) {
            best = current[j + 1]; ai = i - best + 1; bi = j - best + 1;
          }
        }
        previous = current;
      }
      return best ? best + match(a0, ai, b0, bi) + match(ai + best, a1, bi + best, b1) : 0;
    }
    return 2 * match(0, a.length, 0, b.length) / (a.length + b.length);
  },
  check(step, value, threshold = 0.82) {
    if (step.type === "vocabulary") return {correct: true, status: "studied", similarity: 1};
    if (["choice", "listening", "situation"].includes(step.type)) {
      const correct = String(value) === String(step.answer);
      return {correct, status: correct ? "correct" : "incorrect", similarity: correct ? 1 : 0};
    }
    const v = this.normalize(value), choices = (step.accepted || []).map(x => this.normalize(x));
    const correct = choices.includes(v);
    const neg = /\b(no|not|never|dont|doesnt|didnt|cannot|cant|wont|wouldnt|shouldnt|couldnt|isnt|arent|wasnt|werent|havent|hasnt|hadnt|without)\b/;
    const similarity = v ? Math.max(0, ...choices.map(c => this.similarity(v, c))) : 0;
    const keywords = (step.keywords || []).every(k => (` ${v} `).includes(` ${this.normalize(k)} `));
    const near = !!v && keywords && choices.some(c => this.similarity(v, c) >= threshold
      && neg.test(v) === neg.test(c)
      && JSON.stringify(v.match(/\d+/g) || []) === JSON.stringify(c.match(/\d+/g) || []));
    return {correct, status: correct ? "correct" : near ? "near" : v ? "incorrect" : "unrecognized", similarity: Math.round(similarity * 100) / 100};
  },
};
if (typeof module !== "undefined") module.exports = assessmentPolicy;
