require 'net/imap'

class Inboxes::FetchImapEmailsJob < MutexApplicationJob
  queue_as :scheduled_jobs

  def perform(channel, interval = 1)
    return unless should_fetch_email?(channel)

    key = format(::Redis::Alfred::EMAIL_MESSAGE_MUTEX, inbox_id: channel.inbox.id)

    with_lock(key, 5.minutes) do
      process_email_for_channel(channel, interval)
    end
  rescue *ExceptionList::IMAP_EXCEPTIONS => e
    Rails.logger.error "Authorization error for email channel - #{channel.inbox.id} : #{e.message}"
  rescue IOError, OpenSSL::SSL::SSLError, Net::IMAP::NoResponseError, Net::IMAP::BadResponseError, Net::IMAP::InvalidResponseError,
         Net::IMAP::ResponseParseError, Net::IMAP::ResponseReadError, Net::IMAP::ResponseTooLargeError => e
    Rails.logger.error "Error for email channel - #{channel.inbox.id} : #{e.message}"
  rescue LockAcquisitionError
    Rails.logger.error "Lock failed for #{channel.inbox.id}"
  rescue StandardError => e
    ChatwootExceptionTracker.new(e, account: channel.account).capture_exception
  end

  private

  def should_fetch_email?(channel)
    channel.imap_enabled? && !channel.reauthorization_required?
  end

  def process_email_for_channel(channel, interval)
    inbound_emails = if channel.microsoft?
                       Imap::MicrosoftFetchEmailService.new(channel: channel, interval: interval).perform
                     elsif channel.google?
                       Imap::GoogleFetchEmailService.new(channel: channel, interval: interval).perform
                     else
                       Imap::FetchEmailService.new(channel: channel, interval: interval).perform
                     end
    inbound_emails.map { |inbound_mail| process_mail(inbound_mail, channel) }

    process_sent_folder_for_channel(channel, interval) if poll_sent_folder?(channel)
  rescue OAuth2::Error => e
    Rails.logger.error "Error for email channel - #{channel.inbox.id} : #{e.message}"
    channel.authorization_error!
  end

  # Plain-IMAP only (no provider). Pulls messages other clients (Zoho web UI,
  # native mail apps) wrote to INBOX.Sent so they appear in Chatwoot threaded
  # into the original conversation.
  def poll_sent_folder?(channel)
    channel.provider.blank?
  end

  def process_sent_folder_for_channel(channel, interval)
    sent_emails = Imap::FetchEmailService.new(channel: channel, interval: interval, folder: 'INBOX.Sent').perform
    sent_emails.map { |inbound_mail| process_mail(inbound_mail, channel, message_type: 'outgoing') }
  rescue *ExceptionList::IMAP_EXCEPTIONS, IOError, OpenSSL::SSL::SSLError, Net::IMAP::Error => e
    Rails.logger.warn "[IMAP::SENT_FETCH] inbox #{channel.inbox.id}: #{e.message}"
  end

  def process_mail(inbound_mail, channel, message_type: 'incoming')
    Imap::ImapMailbox.new.process(inbound_mail, channel, message_type: message_type)
  rescue StandardError => e
    ChatwootExceptionTracker.new(e, account: channel.account).capture_exception
    Rails.logger.error("
      #{channel.provider} Email dropped: #{inbound_mail.from} and message_source_id: #{inbound_mail.message_id}")
  end
end
