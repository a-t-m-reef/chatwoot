# == Schema Information
#
# Table name: channel_email
#
#  id                        :bigint           not null, primary key
#  aliases                   :string           default([]), is an Array
#  email                     :string           not null
#  forward_to_email          :string           not null
#  imap_address              :string           default("")
#  imap_enable_ssl           :boolean          default(TRUE)
#  imap_enabled              :boolean          default(FALSE)
#  imap_login                :string           default("")
#  imap_password             :string           default("")
#  imap_port                 :integer          default(0)
#  provider                  :string
#  provider_config           :jsonb
#  smtp_address              :string           default("")
#  smtp_authentication       :string           default("login")
#  smtp_domain               :string           default("")
#  smtp_enable_ssl_tls       :boolean          default(FALSE)
#  smtp_enable_starttls_auto :boolean          default(TRUE)
#  smtp_enabled              :boolean          default(FALSE)
#  smtp_login                :string           default("")
#  smtp_openssl_verify_mode  :string           default("none")
#  smtp_password             :string           default("")
#  smtp_port                 :integer          default(0)
#  verified_for_sending      :boolean          default(FALSE), not null
#  created_at                :datetime         not null
#  updated_at                :datetime         not null
#  account_id                :integer          not null
#
# Indexes
#
#  index_channel_email_on_aliases           (aliases) USING gin
#  index_channel_email_on_email             (email) UNIQUE
#  index_channel_email_on_forward_to_email  (forward_to_email) UNIQUE
#

class Channel::Email < ApplicationRecord
  include Channelable
  include Reauthorizable

  AUTHORIZATION_ERROR_THRESHOLD = 10

  # TODO: Remove guard once encryption keys become mandatory (target 3-4 releases out).
  if Chatwoot.encryption_configured?
    encrypts :imap_password
    encrypts :smtp_password
  end

  self.table_name = 'channel_email'
  EDITABLE_ATTRS = [:email, :imap_enabled, :imap_login, :imap_password, :imap_address, :imap_port, :imap_enable_ssl,
                    :smtp_enabled, :smtp_login, :smtp_password, :smtp_address, :smtp_port, :smtp_domain, :smtp_enable_starttls_auto,
                    :smtp_enable_ssl_tls, :smtp_openssl_verify_mode, :smtp_authentication, :provider, :verified_for_sending,
                    { aliases: [] }].freeze

  validates :email, uniqueness: true
  validates :forward_to_email, uniqueness: true
  validate :primary_email_is_not_another_channels_alias
  validate :aliases_are_unique_across_channels
  validate :aliases_do_not_collide_with_primary

  before_validation :normalize_aliases
  before_validation :ensure_forward_to_email, on: :create

  def name
    'Email'
  end

  def microsoft?
    provider == 'microsoft'
  end

  def google?
    provider == 'google'
  end

  def legacy_google?
    imap_enabled && imap_address == 'imap.gmail.com'
  end

  def all_addresses
    ([email] + aliases.to_a).compact_blank.uniq
  end

  # Returns the address this channel should send from for replies. Precedence:
  # 1. Agent override on the outbound message (content_attributes['from_email'])
  # 2. Address the inbound mail came in on
  # 3. Primary email
  # Any candidate that isn't in this channel's known addresses is silently
  # rejected and falls through to the next branch.
  def outbound_address_for(conversation, message: nil)
    allowed = all_addresses.map(&:downcase)

    override = message&.content_attributes&.dig('from_email')
    return override if override.present? && allowed.include?(override.downcase)

    inbound = conversation&.additional_attributes&.dig('inbound_recipient_email')
    return inbound if inbound.present? && allowed.include?(inbound.downcase)

    email
  end

  private

  def ensure_forward_to_email
    self.forward_to_email ||= "#{SecureRandom.hex}@#{account.inbound_email_domain}"
  end

  def normalize_aliases
    self.aliases = (aliases || []).map { |a| a.to_s.downcase.strip }.compact_blank.uniq
  end

  def aliases_do_not_collide_with_primary
    return if aliases.blank? || email.blank?

    errors.add(:aliases, 'cannot include the primary email') if aliases.map(&:downcase).include?(email.downcase)
  end

  def aliases_are_unique_across_channels
    return if aliases.blank?

    conflict_scope = self.class.where('aliases && ARRAY[?]::varchar[] OR LOWER(email) = ANY (ARRAY[?]::varchar[])',
                                      aliases, aliases)
    conflict_scope = conflict_scope.where.not(id: id) if persisted?

    errors.add(:aliases, 'are already in use on another channel') if conflict_scope.exists?
  end

  def primary_email_is_not_another_channels_alias
    return if email.blank?

    conflict_scope = self.class.where('aliases @> ARRAY[?]::varchar[]', email.downcase)
    conflict_scope = conflict_scope.where.not(id: id) if persisted?

    errors.add(:email, 'is already configured as an alias on another channel') if conflict_scope.exists?
  end
end
