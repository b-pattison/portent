class Encounter < ApplicationRecord
  belongs_to :campaign
  has_many :encounter_participants, dependent: :destroy

  STATUSES = %w[setup active completed].freeze
  validates :status, inclusion: { in: STATUSES }

  scope :active, -> { where(status: "active") }
end
