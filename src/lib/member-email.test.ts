import { describe, expect, it } from "vitest";
import { renderMemberEmail, templateProblems } from "./member-email";

const vars = { first_name: "Ada", platform_link: "https://os.example/join/tok" };

describe("member email templates", () => {
  it("fills placeholders, links, paragraphs and line breaks", () => {
    const m = renderMemberEmail(
      { subject: "Hi {{first_name}}", body: "Hi {{ first_name }},\n\nJoin the [Deal Platform]({{platform_link}}) or https://chat.whatsapp.com/abc.\n\nBlué\nCo-Founder" },
      vars,
    );
    expect(m.subject).toBe("Hi Ada");
    expect(m.html).toContain('<a href="https://os.example/join/tok" style="color:#1a3c35;font-weight:bold">Deal Platform</a>');
    expect(m.html).toContain('<a href="https://chat.whatsapp.com/abc"');
    expect(m.html).toContain("Blué<br>Co-Founder");
    expect(m.text).toContain("Deal Platform (https://os.example/join/tok)");
    expect(m.text).not.toContain("Unsubscribe");
  });
  it("escapes HTML and refuses non-web links", () => {
    const m = renderMemberEmail({ subject: "x", body: "<b>hi</b> [click](javascript:alert(1))" }, vars);
    expect(m.html).toContain("&lt;b&gt;hi&lt;/b&gt;");
    expect(m.html).not.toContain('href="javascript');
  });
  it("adds the unsubscribe line to bulk emails", () => {
    const m = renderMemberEmail({ subject: "x", body: "y" }, vars, { unsubscribeUrl: "https://os.example/unsubscribe/t" });
    expect(m.html).toContain("Unsubscribe from these emails");
    expect(m.text).toContain("https://os.example/unsubscribe/t");
  });
  it("lists what must be fixed before sending", () => {
    expect(templateProblems({ subject: "Hi", body: "[WhatsApp](PASTE-WHATSAPP-LINK-HERE) {{firstname}}" })).toEqual([
      "{{firstname}} isn't a placeholder DXV OS knows (use {{first_name}} or {{platform_link}}).",
      "Replace PASTE-WHATSAPP-LINK-HERE with the real link.",
    ]);
    expect(templateProblems({ subject: "Hi {{first_name}}", body: "Hello" })).toEqual([]);
  });
});
