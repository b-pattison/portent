class Character < ApplicationRecord
  belongs_to :campaign
  validates :name, presence: true
  validates :name, uniqueness: {scope: :campaign_id}
  validates :name, length: {minimum: 3, maximum: 255}
  validates :initiative_mod, numericality: {only_integer: true, greater_than_or_equal_to: -5, less_than_or_equal_to: 15}
  has_one_attached :avatar
  validate :validate_avatar

private

  def validate_avatar
    return unless avatar.attached?

    #Must be a PNG or JPG image
    unless avatar.content_type.in?(%w[image/png image/jpeg image/jpg])
      errors.add(:avatar, "Must be a PNG or JPG image.")
    end
    #Must be less than 2MB
    if avatar.byte_size > 2.megabytes
      errors.add(:avatar, "Must be less than 2MB.")
    end
  end
end
