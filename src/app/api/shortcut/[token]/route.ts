import { NextRequest, NextResponse } from "next/server";
import { authenticateToken } from "@/lib/api-auth";

/**
 * Token'i icine gomulmus kisayol dosyasi uretir; kurulumda hicbir sey
 * yapistirmak gerekmez.
 *
 * Yapi, public/shortcut-template.shortcut ile birebir aynidir; o dosya Apple'in
 * `shortcuts sign` araci tarafindan kabul edildigi icin bicimin gecerliligi
 * bilinmektedir. Tek fark: token dogrudan yazilir ve import sorusu kaldirilir.
 *
 * DIKKAT: Uretilen dosya imzasizdir. iOS 15'ten beri ice aktarilan
 * kisayollarin imzali olmasi zorunlu ve "Guvenilmeyen Kisayollara Izin Ver"
 * ayari kaldirildi; bu dosya iPhone'a kurulamaz. Kurulum akisi imzali
 * /Notlarima-Ekle.shortcut uzerinden yurur ve token import sorusuyla girilir.
 *
 * Bu uc nokta, ileride sunucu tarafinda imzalama mumkun olursa (macOS'taki
 * `shortcuts sign`) hazir dursun diye ve plist yapisini belgelemek icin
 * korunuyor. Kurulum arayuzunden link verilmez.
 */

const TOKEN_OUTPUT_UUID = "A1B2C3D4-E5F6-7A8B-9C0D-E1F2A3B4C5D6";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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
				<key>CustomOutputName</key>
				<string>Token</string>
				<key>UUID</key>
				<string>${TOKEN_OUTPUT_UUID}</string>
				<key>WFTextActionText</key>
				<string>${escapeXml(token)}</string>
			</dict>
		</dict>
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.downloadurl</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFURL</key>
				<string>${escapeXml(ingestUrl)}</string>
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
												<key>Type</key>
												<string>ExtensionInput</string>
											</dict>
										</dict>
										<key>string</key>
										<string>&#xFFFC;</string>
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
										<key>attachmentsByRange</key>
										<dict>
											<key>{7, 1}</key>
											<dict>
												<key>OutputUUID</key>
												<string>${TOKEN_OUTPUT_UUID}</string>
												<key>Type</key>
												<string>ActionOutput</string>
											</dict>
										</dict>
										<key>string</key>
										<string>Bearer &#xFFFC;</string>
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
	</array>
	<key>WFWorkflowClientRelease</key>
	<string>1169.0.5</string>
	<key>WFWorkflowClientVersion</key>
	<string>1169</string>
	<key>WFWorkflowHasShortcutInputVariables</key>
	<true/>
	<key>WFWorkflowIcon</key>
	<dict>
		<key>WFWorkflowIconGlyphNumber</key>
		<integer>59511</integer>
		<key>WFWorkflowIconStartColor</key>
		<integer>463140863</integer>
	</dict>
	<key>WFWorkflowImportQuestions</key>
	<array/>
	<key>WFWorkflowInputContentItemClasses</key>
	<array>
		<string>WFStringContentItem</string>
		<string>WFURLContentItem</string>
	</array>
	<key>WFWorkflowMinimumClientRelease</key>
	<string>900.0.0</string>
	<key>WFWorkflowMinimumClientVersion</key>
	<string>900</string>
	<key>WFWorkflowName</key>
	<string>Notlarıma Ekle</string>
	<key>WFWorkflowTypes</key>
	<array>
		<string>ActionExtension</string>
	</array>
</dict>
</plist>`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: "Token gerekli" }, { status: 400 });
  }

  // Bu uc nokta oturum gerektirmez (Kisayollar uygulamasi cerez tasimaz), o
  // yuzden token'in gercekten bir kullaniciya ait oldugu burada dogrulanir.
  try {
    const user = await authenticateToken(token);
    if (!user) {
      return NextResponse.json({ error: "Geçersiz token" }, { status: 404 });
    }
  } catch (error) {
    console.error("Shortcut token doğrulama hatası:", error);
    return NextResponse.json({ error: "Kısayol oluşturulamadı" }, { status: 500 });
  }

  const host = req.headers.get("host") || "notes.kronomondo.org";
  const protocol = host.includes("localhost") ? "http" : "https";
  const ingestUrl = `${protocol}://${host}/api/ingest`;

  return new NextResponse(generateShortcutPlist(ingestUrl, token), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="Notlarima-Ekle.shortcut"',
      "Cache-Control": "no-store",
    },
  });
}
