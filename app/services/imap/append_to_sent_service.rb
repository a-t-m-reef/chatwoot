require 'net/imap'

# Writes a copy of an outgoing reply to the inbox's Sent folder on the IMAP
# server (Dovecot/cPanel: 'INBOX.Sent') so other clients (Zoho web UI, native
# mail apps) see the message in their Sent view. Without this APPEND, sent mail
# only lives in Chatwoot's Postgres and looks "missing" from every other client.
#
# Scoped to plain-IMAP channels — Gmail/Microsoft auto-save sent mail server-side.
# APPEND failure is non-fatal: the SMTP send already succeeded.
class Imap::AppendToSentService
  pattr_initialize [:channel!, :mail!, :folder]

  SENT_FOLDER = 'INBOX.Sent'.freeze

  def perform
    return unless eligible?

    imap = build_imap_client
    imap.append(folder || SENT_FOLDER, mail.to_s, [:Seen], mail.date)
    terminate_imap_connection(imap)
  rescue StandardError => e
    Rails.logger.error("[IMAP::APPEND] Failed for inbox #{channel.inbox.id}: #{e.message}")
    ChatwootExceptionTracker.new(e, account: channel.account).capture_exception
  end

  private

  def eligible?
    channel.imap_enabled && channel.provider.blank?
  end

  def build_imap_client
    imap = Net::IMAP.new(channel.imap_address, port: channel.imap_port, ssl: true)
    imap.authenticate('PLAIN', channel.imap_login, channel.imap_password)
    imap
  end

  def terminate_imap_connection(imap)
    imap.logout
  rescue Net::IMAP::Error => e
    Rails.logger.info "[IMAP::APPEND] Logout failed for #{channel.email} - #{e.message}."
    imap.disconnect
  end
end
