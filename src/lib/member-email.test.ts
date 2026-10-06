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
      "{{firstname}} isn't a placeholder DXV OS knows (use {{first_name}}, {{platform_link}}, {{company}} or {{next_step}}).",
      "Replace PASTE-WHATSAPP-LINK-HERE with the real link.",
    ]);
    expect(templateProblems({ subject: "Hi {{first_name}}", body: "Hello" })).toEqual([]);
  });
});

describe("founder email placeholders", () => {
  it("fills company and next step, and leaves missing ones blank", () => {
    const m = renderMemberEmail({ subject: "{{company}} and DXV", body: "Hi {{first_name}}, next: {{next_step}}." }, { first_name: "Sam", company: "Acme" });
    expect(m.subject).toBe("Acme and DXV");
    expect(m.text).toBe("Hi Sam, next: .");
  });
});

describe("names from founders and members can't become links", () => {
  it("strips link markup, web-address schemes and extra lines from {{company}} / {{first_name}}", () => {
    const m = renderMemberEmail(
      { subject: "Thanks, {{company}}", body: "Hi {{first_name}},\n\nWe've got {{company}}." },
      { first_name: "Sam\n\nClick here", company: "[Reset your password](https://evil.example/x) https://evil.example" },
    );
    expect(m.html).not.toContain("evil.example/x\"");
    expect(m.html).not.toContain("<a ");
    expect(m.text).not.toContain("https://");
    expect(m.text).toContain("Hi Sam Click here,");
  });
  it("leaves DXV's own links alone", () => {
    const m = renderMemberEmail({ subject: "s", body: "Join: {{platform_link}}" }, { first_name: "Sam", platform_link: "https://dxv-os.netlify.app/join/abc" });
    expect(m.html).toContain('href="https://dxv-os.netlify.app/join/abc"');
  });
});
