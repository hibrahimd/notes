import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { authenticateToken } from "@/lib/api-auth";

function generateShortcutPlist(ingestUrl: string, token: string) {

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>WFWorkflowActions</key>
  <array>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.gettext</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFTextActionText</key>
        <dict>
          <key>Value</key>
          <dict>
            <key>attachmentsByRange</key>
            <dict>
              <key>{0, 1}</key>
              <dict>
                <key>Type</key>
                <string>ExtensionInput</string>
              </dict>
            </dict>
            <key>string</key>
            <string>￼</string>
          </dict>
          <key>WFSerializationType</key>
          <string>WFTextTokenString</string>
        </dict>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.detect.link</string>
      <key>WFWorkflowActionParameters</key>
      <dict/>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.downloadurl</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFURL</key>
        <string>${ingestUrl}</string>
        <key>WFHTTPMethod</key>
        <string>POST</string>
        <key>WFHTTPBodyType</key>
        <string>Json</string>
        <key>WFJSONValues</key>
        <dict>
          <key>Value</key>
          <dict>
            <key>WFDictionaryFieldValueItems</key>
            <array>
              <dict>
                <key>WFItemType</key>
                <integer>0</integer>
                <key>WFKey</key>
                <dict>
                  <key>Value</key>
                  <dict>
                    <key>string</key>
                    <string>url</string>
                  </dict>
                  <key>WFSerializationType</key>
                  <string>WFTextTokenString</string>
                </dict>
                <key>WFValue</key>
                <dict>
                  <key>Value</key>
                  <dict>
                    <key>attachmentsByRange</key>
                    <dict>
                      <key>{0, 1}</key>
                      <dict>
                        <key>OutputName</key>
                        <string>URLs</string>
                        <key>OutputUUID</key>
                        <string>DETECT-LINK-UUID</string>
                        <key>Type</key>
                        <string>ActionOutput</string>
                      </dict>
                    </dict>
                    <key>string</key>
                    <string>￼</string>
                  </dict>
                  <key>WFSerializationType</key>
                  <string>WFTextTokenString</string>
                </dict>
              </dict>
            </array>
          </dict>
          <key>WFSerializationType</key>
          <string>WFDictionaryFieldValue</string>
        </dict>
        <key>WFHTTPHeaders</key>
        <dict>
          <key>Value</key>
          <dict>
            <key>WFDictionaryFieldValueItems</key>
            <array>
              <dict>
                <key>WFItemType</key>
                <integer>0</integer>
                <key>WFKey</key>
                <dict>
                  <key>Value</key>
                  <dict>
                    <key>string</key>
                    <string>Authorization</string>
                  </dict>
                  <key>WFSerializationType</key>
                  <string>WFTextTokenString</string>
                </dict>
                <key>WFValue</key>
                <dict>
                  <key>Value</key>
                  <dict>
                    <key>string</key>
                    <string>Bearer ${token}</string>
                  </dict>
                  <key>WFSerializationType</key>
                  <string>WFTextTokenString</string>
                </dict>
              </dict>
            </array>
          </dict>
          <key>WFSerializationType</key>
          <string>WFDictionaryFieldValue</string>
        </dict>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.getvalueforkey</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFDictionaryKey</key>
        <string>success</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.conditional</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFInput</key>
        <dict>
          <key>Type</key>
          <string>Variable</string>
          <key>Variable</key>
          <dict>
            <key>Value</key>
            <dict>
              <key>OutputName</key>
              <string>Dictionary Value</string>
              <key>OutputUUID</key>
              <string>SUCCESS-UUID</string>
              <key>Type</key>
              <string>ActionOutput</string>
            </dict>
            <key>WFSerializationType</key>
            <string>WFTextTokenAttachment</string>
          </dict>
        </dict>
        <key>WFCondition</key>
        <string>Is</string>
        <key>WFConditionalActionString</key>
        <string>true</string>
        <key>GroupingIdentifier</key>
        <string>CONDITION-UUID</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.notification</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFNotificationActionTitle</key>
        <string>✅ Başarılı</string>
        <key>WFNotificationActionBody</key>
        <string>Not kaydedildi!</string>
        <key>WFNotificationActionSound</key>
        <true/>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.conditional</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFControlFlowMode</key>
        <integer>1</integer>
        <key>GroupingIdentifier</key>
        <string>CONDITION-UUID</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.getvalueforkey</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFDictionaryKey</key>
        <string>error</string>
        <key>WFInput</key>
        <dict>
          <key>Type</key>
          <string>Variable</string>
          <key>Variable</key>
          <dict>
            <key>Value</key>
            <dict>
              <key>OutputName</key>
              <string>Contents of URL</string>
              <key>OutputUUID</key>
              <string>DOWNLOAD-UUID</string>
              <key>Type</key>
              <string>ActionOutput</string>
            </dict>
            <key>WFSerializationType</key>
            <string>WFTextTokenAttachment</string>
          </dict>
        </dict>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.notification</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFNotificationActionTitle</key>
        <string>❌ Hata</string>
        <key>WFNotificationActionBody</key>
        <dict>
          <key>Value</key>
          <dict>
            <key>attachmentsByRange</key>
            <dict>
              <key>{0, 1}</key>
              <dict>
                <key>OutputName</key>
                <string>Dictionary Value</string>
                <key>OutputUUID</key>
                <string>ERROR-UUID</string>
                <key>Type</key>
                <string>ActionOutput</string>
              </dict>
            </dict>
            <key>string</key>
            <string>￼</string>
          </dict>
          <key>WFSerializationType</key>
          <string>WFTextTokenString</string>
        </dict>
        <key>WFNotificationActionSound</key>
        <true/>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.conditional</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFControlFlowMode</key>
        <integer>2</integer>
        <key>GroupingIdentifier</key>
        <string>CONDITION-UUID</string>
      </dict>
    </dict>
  </array>
  <key>WFWorkflowClientRelease</key>
  <string>1200</string>
  <key>WFWorkflowClientVersion</key>
  <string>1200</string>
  <key>WFWorkflowIcon</key>
  <dict>
    <key>WFWorkflowIconGlyphNumber</key>
    <integer>59511</integer>
    <key>WFWorkflowIconStartColor</key>
    <integer>4282601983</integer>
  </dict>
  <key>WFWorkflowImportQuestions</key>
  <array/>
  <key>WFWorkflowInputContentItemClasses</key>
  <array>
    <string>WFStringContentItem</string>
    <string>WFURLContentItem</string>
  </array>
  <key>WFWorkflowMinimumClientRelease</key>
  <integer>900</integer>
  <key>WFWorkflowMinimumClientVersion</key>
  <integer>900</integer>
  <key>WFWorkflowName</key>
  <string>Notlarıma Ekle</string>
  <key>WFWorkflowTypes</key>
  <array>
    <string>ActionExtension</string>
  </array>
</dict>
</plist>`;
}

function ingestUrlFor(req: NextRequest): string {
  // Kisayollar uygulamasi Origin basligi gondermez; host uzerinden kur
  const host = req.headers.get("host") || "notes.kronomondo.org";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}/api/ingest`;
}

function shortcutResponse(req: NextRequest, token: string) {
  return new NextResponse(generateShortcutPlist(ingestUrlFor(req), token), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="Notlarima-Ekle.shortcut"',
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token gerekli" }, { status: 400 });
  }

  // Oturum yerine token'in kendisi dogrulanir: Kisayollar uygulamasi cerez tasimaz
  try {
    const user = await authenticateToken(token);
    if (!user) {
      return NextResponse.json({ error: "Geçersiz token" }, { status: 404 });
    }
  } catch (error) {
    console.error("Shortcut token doğrulama hatası:", error);
    return NextResponse.json(
      { error: "Kısayol oluşturulamadı" },
      { status: 500 }
    );
  }

  return shortcutResponse(req, token);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { token } = await req.json();
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token gerekli" }, { status: 400 });
  }

  const user = await authenticateToken(token);
  if (!user || user.id !== session.userId) {
    return NextResponse.json({ error: "Geçersiz token" }, { status: 400 });
  }

  return shortcutResponse(req, token);
}
