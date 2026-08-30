-- Complete channel roadmap requested for the provisioning control plane.
-- Connector classifications describe the safest available integration path;
-- `manual_only` never implies that browser automation may submit content.

ALTER TABLE social_platform_requirement ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE social_platform_requirement ADD COLUMN IF NOT EXISTS business_use TEXT;
ALTER TABLE social_platform_requirement ADD COLUMN IF NOT EXISTS content_strength TEXT;
ALTER TABLE social_platform_requirement ADD COLUMN IF NOT EXISTS automation_level TEXT;
ALTER TABLE social_platform_requirement ADD COLUMN IF NOT EXISTS manual_prerequisite TEXT;

INSERT INTO ref_social_platform(platform,display_name,connector,max_characters,supports_scheduling,notes) VALUES
 ('snapchat','Snapchat','manual_only',NULL,false,'Business/developer setup; no general organic publishing connector'),
 ('substack','Substack','manual_only',NULL,false,'Publication workflow; no supported general write API'),
 ('github','GitHub','custom_connector',65536,true,'Repository releases, discussions and documentation'),
 ('gitlab','GitLab','custom_connector',65536,true,'Projects, releases and documentation through API token'),
 ('stack_overflow','Stack Overflow','manual_only',NULL,false,'Technical participation only; never automate marketing answers'),
 ('yelp','Yelp','manual_only',NULL,false,'Business claim and reputation workflow'),
 ('tripadvisor','Tripadvisor','manual_only',NULL,false,'Business claim and reputation workflow'),
 ('trustpilot','Trustpilot','custom_connector',NULL,false,'Business review invitation/integration workflow'),
 ('vimeo','Vimeo','custom_connector',5000,true,'Professional video API'),
 ('dailymotion','Dailymotion','custom_connector',5000,true,'Video distribution API'),
 ('spotify','Spotify','manual_only',NULL,false,'Creator/podcast distribution workflow'),
 ('apple_podcasts','Apple Podcasts','manual_only',NULL,false,'RSS/Apple creator distribution workflow'),
 ('soundcloud','SoundCloud','custom_connector',4000,true,'API availability depends on approved application'),
 ('patreon','Patreon','custom_connector',NULL,true,'Creator membership integration')
ON CONFLICT(platform) DO UPDATE SET display_name=EXCLUDED.display_name,connector=EXCLUDED.connector,notes=EXCLUDED.notes;

WITH roadmap(platform,priority,business_use,content_strength,automation_level,manual_prerequisite,signup_url,developer_portal_url,oauth_supported,api_supported,publishing_supported,mode,policy) AS (VALUES
 ('tiktok','red','B2C awareness and viral reach','Short video and live','high','Account and developer OAuth','https://www.tiktok.com/signup','https://developers.tiktok.com/',true,true,true,'MANUAL','Developer approval and user consent are mandatory.'),
 ('pinterest','red','Retail, lifestyle and discovery','Images, pins and video','high','Business and developer access','https://www.pinterest.com/business/create/','https://developers.pinterest.com/',true,true,true,'MANUAL','Business ownership and OAuth consent are human-controlled.'),
 ('reddit','red','Community and research','Discussion and text','medium','Account and API authorization','https://www.reddit.com/register/','https://www.reddit.com/prefs/apps',true,true,true,'MANUAL','Respect subreddit rules; never automate spam or deceptive participation.'),
 ('whatsapp_business','red','Customer communication','Messages and media','high','Business and number verification','https://business.whatsapp.com/','https://developers.facebook.com/apps/',true,true,true,'MANUAL','Number and business verification plus template approval remain human tasks.'),
 ('telegram','red','Community and broadcast','Text, media and bots','very_high','Bot and channel setup','https://telegram.org/','https://t.me/BotFather',false,true,true,'OFFICIAL_API','A human creates the bot and grants channel administrator access.'),
 ('threads','orange','Brand conversation','Short text and images','high','Meta and Threads setup','https://www.threads.net/','https://developers.facebook.com/apps/',true,true,true,'MANUAL','Meta OAuth, permissions, review and consent remain human-controlled.'),
 ('snapchat','orange','Younger consumer audiences','Short visual and video','limited','Business and developer setup','https://accounts.snapchat.com/','https://business.snapchat.com/',true,true,false,'MANUAL','Do not claim organic publishing support where none is configured.'),
 ('discord','orange','Community and product','Chat, events and bots','very_high','Server and bot authorization','https://discord.com/register','https://discord.com/developers/applications',true,true,true,'MANUAL','A server owner must authorize the bot or webhook.'),
 ('twitch','orange','Live community','Live video and chat','high','Account and developer OAuth','https://www.twitch.tv/signup','https://dev.twitch.tv/console/apps',true,true,true,'MANUAL','OAuth consent and broadcaster authorization are human tasks.'),
 ('medium','orange','Thought leadership','Long-form articles','medium','Publication or account setup','https://medium.com/','https://medium.com/me/settings/security',false,true,true,'MANUAL','Connection is performed through the provider UI.'),
 ('substack','orange','Newsletter and community','Articles and email','limited','Publication setup','https://substack.com/signup',NULL,false,false,false,'MANUAL','Draft assistance only; a human publishes.'),
 ('quora_manual','orange','Expertise and demand discovery','Questions and answers','limited','Account','https://www.quora.com/',NULL,false,false,false,'MANUAL','Draft assistance only; never automate answers.'),
 ('tumblr','yellow','Niche communities','Text, image and GIF','high','App and API authorization','https://www.tumblr.com/register','https://www.tumblr.com/oauth/apps',true,true,true,'MANUAL','OAuth consent remains human-controlled.'),
 ('mastodon','yellow','Open social community','Text and media','high','Instance account and app','https://joinmastodon.org/servers',NULL,true,true,true,'MANUAL','The user selects the instance and authorizes the app.'),
 ('bluesky','yellow','Conversation and technology audiences','Text and media','high','Account and app password','https://bsky.app/','https://bsky.app/settings/app-passwords',false,true,true,'MANUAL','Use an app password, never the primary account password.'),
 ('github','yellow','Developer marketing','Code, docs and releases','very_high','Account, organization, app or token','https://github.com/signup','https://github.com/settings/apps',true,true,true,'MANUAL','Repository permissions and organization approval are human-controlled.'),
 ('gitlab','yellow','Developer and B2B','Code, releases and docs','high','Account and API token','https://gitlab.com/users/sign_up','https://gitlab.com/-/user_settings/applications',true,true,true,'MANUAL','Use scoped project or group authorization.'),
 ('stack_overflow','yellow','Developer reputation','Technical Q&A','none','Account','https://stackoverflow.com/users/signup',NULL,true,true,false,'MANUAL','Never automate marketing posts or answers.'),
 ('google_business','yellow','Local business','Updates, photos and reviews','medium','Business ownership and verification','https://business.google.com/','https://console.cloud.google.com/',true,true,true,'MANUAL','Business ownership and Google verification are mandatory.'),
 ('yelp','yellow','Local reputation','Reviews and business information','limited','Business claim','https://biz.yelp.com/','https://www.yelp.com/developers',true,true,false,'MANUAL','Claim management and responses remain human-led.'),
 ('tripadvisor','yellow','Travel and hospitality','Reviews and photos','limited','Business claim','https://www.tripadvisor.com/Owners',NULL,false,false,false,'MANUAL','Claim management and responses remain human-led.'),
 ('trustpilot','yellow','Reputation and social proof','Reviews','medium','Business account and integration','https://business.trustpilot.com/','https://developers.trustpilot.com/',true,true,false,'MANUAL','Use supported invitation and review workflows only.'),
 ('vimeo','yellow','Professional video','Video','high','Account and API','https://vimeo.com/join','https://developer.vimeo.com/apps',true,true,true,'MANUAL','OAuth and upload authorization are human-controlled.'),
 ('dailymotion','yellow','Video distribution','Video','medium','Developer API','https://www.dailymotion.com/signup','https://developers.dailymotion.com/',true,true,true,'MANUAL','OAuth and channel authorization are human-controlled.'),
 ('spotify','yellow','Podcast and audio marketing','Audio and podcasts','limited','Creator account','https://creators.spotify.com/','https://developer.spotify.com/dashboard',true,true,false,'MANUAL','Distribution is creator/RSS-led; do not claim episode publishing API support.'),
 ('apple_podcasts','yellow','Podcast distribution','Audio','limited','Apple and creator setup','https://podcasters.apple.com/','https://podcasters.apple.com/',true,false,false,'MANUAL','Distribution is RSS/creator-led and requires Apple account actions.'),
 ('soundcloud','yellow','Music and audio','Audio','limited','Account and approved API access','https://soundcloud.com/sign-up','https://developers.soundcloud.com/',true,true,true,'MANUAL','API write access depends on an approved application.'),
 ('patreon','yellow','Creator membership','Community and content','medium','Creator and developer setup','https://www.patreon.com/create','https://www.patreon.com/portal/registration/register-clients',true,true,true,'MANUAL','Creator authorization and membership boundaries are mandatory.')
)
INSERT INTO social_platform_requirement(platform,priority,business_use,content_strength,automation_level,manual_prerequisite,signup_url,developer_portal_url,oauth_supported,api_supported,publishing_supported,developer_creation_mode,automation_policy)
SELECT platform,priority,business_use,content_strength,automation_level,manual_prerequisite,signup_url,developer_portal_url,oauth_supported,api_supported,publishing_supported,mode,policy FROM roadmap
ON CONFLICT(platform) DO UPDATE SET priority=EXCLUDED.priority,business_use=EXCLUDED.business_use,content_strength=EXCLUDED.content_strength,automation_level=EXCLUDED.automation_level,manual_prerequisite=EXCLUDED.manual_prerequisite,signup_url=EXCLUDED.signup_url,developer_portal_url=EXCLUDED.developer_portal_url,oauth_supported=EXCLUDED.oauth_supported,api_supported=EXCLUDED.api_supported,publishing_supported=EXCLUDED.publishing_supported,developer_creation_mode=EXCLUDED.developer_creation_mode,automation_policy=EXCLUDED.automation_policy,updated_at=now();
