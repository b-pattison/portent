class Character < ApplicationRecord
  belongs_to :campaign
  has_many :encounter_participants, dependent: :destroy
  validates :name, presence: true
  validates :name, length: {minimum: 3, maximum: 255}
  validate :unique_name_for_permanent_characters
  validates :initiative_mod, numericality: {only_integer: true, greater_than_or_equal_to: -5, less_than_or_equal_to: 15}
  has_one_attached :avatar
  validate :validate_avatar

  scope :pcs,  -> { where(pc: true) }
  scope :npcs, -> { where(pc: false) }
  scope :permanent, -> { where(temporary: false) }
  scope :temporary, -> { where(temporary: true) }

  def permanent?
    !temporary
  end

  def temporary?
    temporary
  end

private

  def unique_name_for_permanent_characters
    return unless permanent?
    return if name.blank?

    existing = campaign.characters.permanent.where(name: name)
    existing = existing.where.not(id: id) if persisted?
    
    if existing.exists?
      errors.add(:name, "has already been taken")
    end
  end

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
