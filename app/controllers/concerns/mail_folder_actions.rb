module MailFolderActions
  extend ActiveSupport::Concern

  # Sets/clears the email-style folder (spam/trash) on a conversation.
  # An empty folder restores the conversation to the inbox.
  def mail_folder
    return head :unprocessable_entity unless params[:folder].to_s.in?(['spam', 'trash', ''])

    @conversation.update_mail_folder!(params[:folder].presence)
    head :ok
  end
end
